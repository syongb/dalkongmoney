"use client";

import { useActionState } from "react";
import { updateDisplayName, type DisplayNameActionState } from "./actions";

const initialState: DisplayNameActionState = { message: "" };

export function DisplayNameForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateDisplayName, initialState);

  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block text-sm font-medium">
        내 이름
        <input
          name="display_name"
          required
          maxLength={60}
          defaultValue={displayName}
          className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 outline-none focus:border-stone-700"
        />
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
        className="min-h-12 w-full rounded-xl bg-stone-900 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "저장하는 중…" : "이름 저장"}
      </button>
    </form>
  );
}
