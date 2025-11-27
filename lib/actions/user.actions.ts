// /lib/actions/user.actions.ts
'use server';

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { cookies } from "next/headers";
import { encryptId, extractCustomerIdFromUrl, parseStringify } from "../utils";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { revalidatePath } from "next/cache";
import { addFundingSource, createDwollaCustomer } from "./dwolla.actions";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_TABLE_ID: USER_TABLE_ID,
  APPWRITE_BANK_TABLE_ID: BANK_TABLE_ID
} = process.env;

/**
 * Fetch the DB user document for an auth userId.
 * Returns parsed object or null.
 */
export const getUserInfo = async ({ userId }: getUserInfoProps) => {
  try {
    const { database } = await createAdminClient();

    // NOTE: Query.equal expects a string value (not an array)
    const result = await database.listDocuments(
      DATABASE_ID!,
      USER_TABLE_ID!,
      [Query.equal('userId', userId)]
    );

    // result.documents may be empty, so guard it
    if (!result || !result.documents || result.documents.length === 0) {
      console.log(`DEBUG getUserInfo() -> no user found for userId: ${userId}`);
      return null;
    }

    console.log('DEBUG getUserInfo() -> total:', result.total);
    return parseStringify(result.documents[0]);
  } catch (error) {
    console.log('DEBUG getUserInfo() error:', error);
    return null;
  }
};

export const signIn = async ({ email, password }: signInProps) => {
  try {
    const { account, database } = await createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    // Try to find DB user row
    const dbUser = await getUserInfo({ userId: session.userId });

    if (dbUser) {
      console.log("DEBUG signIn() -> found DB user for session.userId:", session.userId);
      return parseStringify(dbUser);
    }

    // If DB user is missing, create a minimal user document automatically
    console.log("DEBUG signIn() -> no DB user found, creating minimal DB row for userId:", session.userId);

    // fetch auth account to populate some fields
    const authAccount = await account.get();

    const createPayload = {
      userId: authAccount.$id,
      firstName: (authAccount.name && authAccount.name.split(" ")[0]) || "User",
      lastName: (authAccount.name && authAccount.name.split(" ")[1]) || "",
      email: authAccount.email || email,
      // leave Dwolla fields empty — they will be populated at signup flow if required
      dwollaCustomerId: "",
      dwollaCustomerUrl: "",
    };

    const created = await database.createDocument(
      DATABASE_ID!,
      USER_TABLE_ID!,
      ID.unique(),
      createPayload
    );

    console.log("DEBUG signIn() -> created DB user:", created.$id);
    return parseStringify(created);
  } catch (error) {
    console.error('Error signIn():', error);
    return null;
  }
};

export const signUp = async ({ password, ...userData }: SignUpParams) => {
  const { email, firstName, lastName } = userData;

  let newUserAccount;

  try {
    const { account, database } = await createAdminClient();

    // Create Appwrite auth user
    newUserAccount = await account.create(
      ID.unique(),
      email,
      password,
      `${firstName} ${lastName}`
    );

    if (!newUserAccount) throw new Error("Error creating an auth user");

    console.log("DEBUG SIGNUP: AUTH USER ID =", newUserAccount.$id);

    // Create Dwolla customer
    const dwollaCustomerUrl = await createDwollaCustomer(userData);

    if (!dwollaCustomerUrl) throw new Error("Error creating Dwolla Customer");

    const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);

    // Store user in Appwrite DB
    const newUser = await database.createDocument(
      DATABASE_ID!,
      USER_TABLE_ID!,
      ID.unique(),
      {
        ...userData,
        userId: newUserAccount.$id,
        dwollaCustomerId,
        dwollaCustomerUrl,
      }
    );

    console.log("DEBUG SIGNUP: DB USER ROW ID =", newUser.$id);

    // Create session and store cookie
    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return parseStringify(newUser);
  } catch (error) {
    console.error("Error signUp():", error);
    return null;
  }
};


export async function getLoggedInUser() {
  try {
    const { account } = await createSessionClient();

    const authAccount = await account.get();
    console.log("DEBUG getLoggedInUser() -> authAccount:", authAccount);

    return authAccount;
  } catch (err) {
    console.log("DEBUG getLoggedInUser() error:", err);
    return null;
  }
}

export const logoutAccount = async () => {
  try {
    const { account } = await createSessionClient();

    cookies().delete("appwrite-session");

    await account.deleteSession("current");
    return true;
  } catch (err) {
    console.error("logoutAccount error:", err);
    return null;
  }
};

export const createLinkToken = async (user: User) => {
  try {
    const tokenParams = {
      user: {
        client_user_id: user.$id,
      },
      client_name: `${user.firstName} ${user.lastName}`,
      products: ["auth"] as Products[],
      language: "en",
      country_codes: ["US"] as CountryCode[],
    };

    const response = await plaidClient.linkTokenCreate(tokenParams);

    return parseStringify({ linkToken: response.data.link_token });
  } catch (error) {
    console.log("createLinkToken error:", error);
    return null;
  }
};

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  try {
    const { database } = await createAdminClient();

    const bankAccount = await database.createDocument(
      DATABASE_ID!,
      BANK_TABLE_ID!,
      ID.unique(),
      {
        userId,
        bankId,
        accountId,
        accessToken,
        fundingSourceUrl,
        shareableId,
      }
    );

    return parseStringify(bankAccount);
  } catch (error) {
    console.log("createBankAccount error:", error);
    return null;
  }
};

export const exchangePublicToken = async ({
  publicToken,
  user,
}: exchangePublicTokenProps) => {
  console.log("DEBUG EXCHANGE: using userId =", user.$id);
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accountData = accountsResponse.data.accounts[0];

    const request: ProcessorTokenCreateRequest = {
      access_token: accessToken,
      account_id: accountData.account_id,
      processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
    };

    const processorTokenResponse =
      await plaidClient.processorTokenCreate(request);

    const processorToken = processorTokenResponse.data.processor_token;

    const fundingSourceUrl = await addFundingSource({
      dwollaCustomerId: user.dwollaCustomerId,
      processorToken,
      bankName: accountData.name,
    });

    if (!fundingSourceUrl) throw Error;

    await createBankAccount({
      userId: user.$id,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl,
      shareableId: encryptId(accountData.account_id),
    });

    revalidatePath("/");

    return parseStringify({
      publicTokenExchange: "complete",
    });
  } catch (error) {
    console.error("exchangePublicToken error:", error);
    return null;
  }
};

export const getBanks = async ({ userId }: getBanksProps) => {
  try {
    const { database } = await createAdminClient();

    const result = await database.listDocuments(
      DATABASE_ID!,
      BANK_TABLE_ID!,
      [Query.equal('userId', userId)]
    );

    if (!result || !result.documents || result.total === 0) {
      console.log(`DEBUG getBanks() -> no banks found for userId: ${userId}`);
      return [];
    }

    console.log(`DEBUG getBanks() -> found ${result.total} banks for userId: ${userId}`);
    return parseStringify(result.documents);
  } catch (error) {
    console.log('DEBUG getBanks() error:', error);
    return [];
  }
};

export const getBank = async ({ documentId }: getBankProps) => {
  try {
    if (!documentId) {
      console.log('DEBUG getBank() -> documentId was empty or undefined');
      return null;
    }

    const { database } = await createAdminClient();

    const result = await database.listDocuments(
      DATABASE_ID!,
      BANK_TABLE_ID!,
      [Query.equal('$id', documentId)]
    );

    if (!result || !result.documents || result.total === 0) {
      console.log(`DEBUG getBank() -> no bank found with $id: ${documentId}`);
      return null;
    }

    return parseStringify(result.documents[0]);
  } catch (error) {
    console.log('DEBUG getBank() error:', error);
    return null;
  }
};

export const getBankByAccountId = async ({ accountId }: getBankByAccountIdProps) => {
  try {
    const { database } = await createAdminClient();

    const result = await database.listDocuments(
      DATABASE_ID!,
      BANK_TABLE_ID!,
      [Query.equal('accountId', accountId)]
    );

    if (!result || result.total !== 1) {
      console.log(`DEBUG getBankByAccountId() -> bank not found or multiple for accountId: ${accountId}`);
      return null;
    }

    return parseStringify(result.documents[0]);
  } catch (error) {
    console.log('DEBUG getBankByAccountId() error:', error);
    return null;
  }
};