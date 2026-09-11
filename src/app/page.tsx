import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateHouseholdForm, InviteForm } from "./action-forms";
import { signOut } from "./actions";

type Membership = { role: "owner" | "member"; households: { id: string; name: string; currency_code: string } | { id: string; name: string; currency_code: string }[] | null };

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: rawMembership }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("household_members").select("role, households(id, name, currency_code)").eq("user_id", user.id).maybeSingle(),
  ]);
  const membership = rawMembership as Membership | null;
  const household = Array.isArray(membership?.households) ? membership.households[0] : membership?.households;

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-10">
      <header className="flex items-center justify-between">
        <div><p className="text-sm text-stone-500">안녕하세요</p><h1 className="text-xl font-bold">{profile?.display_name ?? user.email}</h1></div>
        <form action={signOut}><button className="min-h-11 px-3 text-sm underline">로그아웃</button></form>
      </header>
      {!household ? (
        <section className="mt-12 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">함께 쓸 가계부 만들기</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">먼저 가계부를 만든 다음 일회용 링크로 배우자를 초대할 수 있습니다.</p>
          <CreateHouseholdForm />
        </section>
      ) : (
        <section className="mt-12 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-stone-500">현재 가계부</p><h2 className="mt-1 text-2xl font-bold">{household.name}</h2>
          <p className="mt-2 text-sm text-stone-600">{membership?.role === "owner" ? "관리자" : "구성원"} · {household.currency_code}</p>
          {membership?.role === "owner" && <InviteForm />}
          <div className="mt-6 rounded-xl bg-stone-100 p-4 text-sm leading-6 text-stone-600">거래 등록과 예산 화면은 다음 Phase에서 차례로 추가합니다.</div>
        </section>
      )}
    </main>
  );
}
