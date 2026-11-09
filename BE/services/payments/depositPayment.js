// Contract deposits live on the contract (depositStatus), but the money still belongs in the
// payment ledger: one CONTRACT_DEPOSIT payment per contract, kept apart from invoice payments.
const { Payment } = require("../../models");

// Manual confirmations have no bank reference: the contract code is the receipt number.
const manualDepositReference = (contractCode) => `COC-${contractCode}`;

async function recordDepositPayment(contract, details, session) {
  const [payment] = await Payment.create(
    [
      {
        purpose: "CONTRACT_DEPOSIT",
        landlordId: contract.landlordId,
        branchId: contract.branchId,
        contractId: contract._id,
        contractCode: contract.contractCode,
        tenantId: contract.tenantId,
        amount: contract.depositAmount,
        status: "SUCCESS",
        ...details,
      },
    ],
    { session },
  );
  return payment;
}

module.exports = { recordDepositPayment, manualDepositReference };
