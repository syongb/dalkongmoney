"use client";

import { useActionState } from "react";
import { deleteTransaction, type TransactionActionState } from "./actions";

const initialState: TransactionActionState = { message: "" };

export function DeleteTransactionForm({ transactionId }: { transactionId: string }) {
  const deleteAction = deleteTransaction.bind(null, transactionId);
  const [state, action, pending] = useActionState(deleteAction, initialState);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("이 거래를 삭제할까요?")) event.preventDefault();
      }}
      className="mt-8 border-t border-stone-200 pt-6"
    >
      <button disabled={pending} className="min-h-12 w-full rounded-xl border border-red-300 bg-white font-semibold text-red-700 disabled:opacity-50">
        {pending ? "삭제하는 중…" : "거래 삭제"}
      </button>
      {state.message && <p role="status" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.message}</p>}
    </form>
  );
}
