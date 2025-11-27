import HeaderBox from '@/components/HeaderBox';
import RightSidebar from '@/components/RightSidebar';
import TotalBalanceBox from '@/components/TotalBalanceBox';
import { getAccount, getAccounts } from '@/lib/actions/bank.actions';
import { getLoggedInUser, getUserInfo } from '@/lib/actions/user.actions';

const Home = async ({ searchParams: { id, page } }: SearchParamProps) => {
  // 1) get the auth account (from Appwrite session)
  const authAccount = await getLoggedInUser();

  // If no session/auth user, show guest view and avoid calling bank actions (they rely on user id)
  if (!authAccount) {
    return (
      <section className="home">
        <div className="home-content">
          <header className="home-header">
            <HeaderBox
              type="greeting"
              title="Welcome"
              user={"Guest"}
              subtext="Sign in to access your account and transactions."
            />

            <TotalBalanceBox
              accounts={[]}
              totalBanks={0}
              totalCurrentBalance={0}
            />
          </header>

          <div className="px-6">
            <p className="text-center text-gray-600">Please sign in to view your dashboard.</p>
          </div>
        </div>

        <RightSidebar user={null} transactions={[]} banks={[]} />
      </section>
    );
  }

  // 2) we have an auth account => fetch DB user document (firstName, lastName, etc.)
  const loggedIn = await getUserInfo({ userId: authAccount.$id });

  // 3) fetch accounts only now that we have a valid userId
  const accounts = await getAccounts({ userId: authAccount.$id });

  if (!accounts) {
    // no accounts (or error fetching) — still render safely
    return (
      <section className="home">
        <div className="home-content">
          <header className="home-header">
            <HeaderBox
              type="greeting"
              title="Welcome"
              user={loggedIn?.firstName || "Guest"}
              subtext="Access and manage your account and transactions efficiently."
            />

            <TotalBalanceBox accounts={[]} totalBanks={0} totalCurrentBalance={0} />
          </header>

          <div className="px-6">
            <p className="text-center text-gray-600">No linked banks yet.</p>
          </div>
        </div>

        <RightSidebar user={loggedIn} transactions={[]} banks={[]} />
      </section>
    );
  }

  const accountsData = accounts?.data;
  const appwriteItemId = (id as string) || accountsData?.[0]?.appwriteItemId;
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;

  return (
    <section className="home">
      <div className="home-content">
        <header className="home-header">
          <HeaderBox
            type="greeting"
            title="Welcome"
            user={loggedIn?.firstName || "Guest"}
            subtext="Access and manage your account and transactions efficiently."
          />

          <TotalBalanceBox
            accounts={accountsData}
            totalBanks={accounts?.totalBanks}
            totalCurrentBalance={accounts?.totalCurrentBalance}
          />
        </header>

        {/* Placeholder (you said this is only a placeholder for now) */}
        <div className="px-6">RECENT TRANSACTIONS</div>
      </div>

      <RightSidebar user={loggedIn} transactions={accounts?.transactions} banks={accountsData?.slice(0, 2)} />
    </section>
  );
};

export default Home;
