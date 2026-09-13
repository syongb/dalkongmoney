"use client";

import { useActionState } from "react";
import { updateNames, type DisplayNameActionState } from "./actions";

const initialState: DisplayNameActionState = { message: "" };

export function DisplayNameForm({ displayName, householdName }: { displayName: string; householdName: string }) {
  const [state, action, pending] = useActionState(updateNames, initialState);

  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium">
        내 이름
        <input
          name="display_name"
          required
          maxLength={60}
          defaultValue={displayName}
          className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-700"
        />
      </label>
      <label className="block text-sm font-medium">
        가계부 이름
        <input name="household_name" required maxLength={60} defaultValue={householdName} className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-700" />
      </label>
      {state.message && (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
        >
          {state.message}
        </p>
      )}
      <button
        disabled={pending}
        className="min-h-11 w-full rounded-lg bg-stone-900 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "저장하는 중…" : "저장"}
      </button>
    </form>
  );
}
