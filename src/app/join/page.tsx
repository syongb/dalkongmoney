import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitationForm } from "../action-forms";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  if (!token) return <main className="mx-auto max-w-md px-5 py-16"><h1 className="text-2xl font-bold">올바르지 않은 초대 링크입니다.</h1></main>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`);
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-16">
      <p className="text-sm font-semibold text-emerald-700">우리 가계부</p><h1 className="mt-2 text-2xl font-bold">배우자의 가계부에 참여할까요?</h1>
      <p className="mt-3 text-stone-600">초대 링크는 24시간 동안 한 번만 사용할 수 있습니다.</p>
      <AcceptInvitationForm token={token} />
    </main>
  );
}
