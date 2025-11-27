import HeaderBox from '@/components/HeaderBox'
import PaymentTransferForm from '@/components/PaymentTransferForm'
import { getAccounts } from '@/lib/actions/bank.actions';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import React from 'react'

const Transfer = async () => {
  const loggedIn = await getLoggedInUser();

  // ⭐ FIX: Handle null session
  if (!loggedIn) {
    return (
      <section className="payment-transfer">
        <HeaderBox 
          title="Payment Transfer"
          subtext="You must be signed in to transfer funds."
        />
        <p className="text-red-500 pt-4">No active session found.</p>
      </section>
    );
  }

  const accounts = await getAccounts({ 
    userId: loggedIn.$id 
  });

  if (!accounts) {
    return (
      <section className="payment-transfer">
        <HeaderBox 
          title="Payment Transfer"
          subtext="No accounts found."
        />
      </section>
    );
  }

  const accountsData = accounts?.data;

  return (
    <section className="payment-transfer">
      <HeaderBox 
        title="Payment Transfer"
        subtext="Please provide any specific details or notes related to the payment transfer"
      />

      <section className="size-full pt-5">
        <PaymentTransferForm accounts={accountsData} />
      </section>
    </section>
  );
}

export default Transfer;
