"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptInvitation, createHousehold, createInvitation, type ActionState } from "./actions";

const initialState: ActionState = { message: "" };

export function CreateHouseholdForm() {
  const [state, action, pending] = useActionState(createHousehold, initialState);
  return (
    <form action={action} className="mt-6 space-y-3">
      <label className="block text-sm font-medium">가계부 이름
        <input name="name" required maxLength={60} defaultValue="우리 집" className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4" />
      </label>
      {state.message && <p className="text-sm text-stone-600">{state.message}</p>}
      <button disabled={pending} className="min-h-12 w-full rounded-xl bg-stone-900 font-semibold text-white disabled:opacity-50">{pending ? "만드는 중…" : "가계부 만들기"}</button>
    </form>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvitation, initialState);
  return (
    <form action={action} className="mt-5">
      <button disabled={pending} className="min-h-12 w-full rounded-xl border border-stone-300 bg-white font-semibold disabled:opacity-50">{pending ? "링크 만드는 중…" : "배우자 초대 링크 만들기"}</button>
      {state.message && <p className="mt-3 text-sm text-stone-600">{state.message}</p>}
      {state.inviteUrl && <input readOnly aria-label="배우자 초대 링크" value={state.inviteUrl} onFocus={(event) => event.currentTarget.select()} className="mt-2 min-h-12 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-sm" />}
    </form>
  );
}

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, initialState);
  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <button disabled={pending} className="min-h-12 w-full rounded-xl bg-stone-900 font-semibold text-white disabled:opacity-50">{pending ? "참여하는 중…" : "이 가계부에 참여하기"}</button>
      {state.message && <p role="status" className="mt-3 rounded-xl bg-stone-100 p-3 text-sm">{state.message}</p>}
      {state.message === "가계부에 참여했습니다." && <Link href="/" className="mt-3 block text-center text-sm font-semibold underline">홈으로 이동</Link>}
    </form>
  );
}
