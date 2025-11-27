"use server";

import { Client } from "dwolla-v2";

// ----------------------------------
// MISSING TYPES (ADD THESE AT TOP)
// ----------------------------------
export interface CreateFundingSourceOptions {
  customerId: string;
  fundingSourceName: string;
  plaidToken: string;
}

export interface AddFundingSourceParams {
  dwollaCustomerId: string;
  processorToken: string;
  bankName: string;
}

// Signup customer type
export interface NewDwollaCustomerParams {
  firstName: string;
  lastName: string;
  email: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  dateOfBirth: string;
  ssn: string;
}


const getEnvironment = (): "production" | "sandbox" => {
  const env = process.env.DWOLLA_ENV;

  if (env === "production") return "production";
  return "sandbox"; // default
};

const dwollaClient = new Client({
  environment: getEnvironment(),
  key: process.env.DWOLLA_KEY!,
  secret: process.env.DWOLLA_SECRET!,
});

// -------------------------------------------------------
// CREATE CUSTOMER (FIXED)
// -------------------------------------------------------
export const createDwollaCustomer = async (customer: NewDwollaCustomerParams) => {
  try {
    const body = {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      type: "personal",          // REQUIRED
      address1: customer.address1,
      city: customer.city,
      state: customer.state,
      postalCode: customer.postalCode,
      dateOfBirth: customer.dateOfBirth,
      ssn: customer.ssn,
      ipAddress: "127.0.0.1",
    };

    const res = await dwollaClient.post("customers", body);

    const location = res.headers.get("location");
    console.log("DWOLLA CUSTOMER CREATED:", location);

    return location;

  } catch (err: any) {
    console.error("Dwolla customer creation FAILED:", err?.message || err);
    return null;
  }
};

// -------------------------------------------------------
// On-demand authorization
// -------------------------------------------------------
export const createOnDemandAuthorization = async () => {
  try {
    const res = await dwollaClient.post("on-demand-authorizations");
    return res.body._links;
  } catch (err) {
    console.error("Failed creating On-Demand Authorization:", err);
    return null;
  }
};

// -------------------------------------------------------
// CREATE FUNDING SOURCE (CORRECT VERSION)
// -------------------------------------------------------
export const createFundingSource = async (options: CreateFundingSourceOptions) => {
  try {
    const res = await dwollaClient.post(
      `customers/${options.customerId}/funding-sources`,
      {
        name: options.fundingSourceName,
        plaidToken: options.plaidToken,
      }
    );

    return res.headers.get("location");
  } catch (err) {
    console.error("Dwolla funding source FAILED:", err);
    return null;
  }
};

// -------------------------------------------------------
// Public function used in exchangePublicToken()
// -------------------------------------------------------
export const addFundingSource = async ({
  dwollaCustomerId,
  processorToken,
  bankName,
}: AddFundingSourceParams) => {
  try {
    const authLinks = await createOnDemandAuthorization();
    if (!authLinks) {
      console.error("❌ No on-demand auth links returned");
      return null;
    }

    const url = await createFundingSource({
      customerId: dwollaCustomerId,
      fundingSourceName: bankName,
      plaidToken: processorToken,
    });

    return url;
  } catch (err) {
    console.error("addFundingSource() FAILED:", err);
    return null;
  }
};

// -------------------------------------------------------
// CREATE DWOLLA TRANSFER  (REQUIRED FOR PaymentTransferForm)
// -------------------------------------------------------
export const createTransfer = async ({
  sourceFundingSourceUrl,
  destinationFundingSourceUrl,
  amount,
}: {
  sourceFundingSourceUrl: string;
  destinationFundingSourceUrl: string;
  amount: string;
}) => {
  try {
    const res = await dwollaClient.post("transfers", {
      _links: {
        source: {
          href: sourceFundingSourceUrl,
        },
        destination: {
          href: destinationFundingSourceUrl,
        },
      },
      amount: {
        currency: "USD",
        value: amount,
      },
    });

    const transferUrl = res.headers.get("location");
    console.log("DWOLLA TRANSFER CREATED:", transferUrl);

    return transferUrl;
  } catch (err: any) {
    console.error("Dwolla transfer FAILED:", err?.message || err);
    return null;
  }
};
