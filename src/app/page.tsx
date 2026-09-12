import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateHouseholdForm, InviteForm } from "./action-forms";
import { signOut } from "./actions";
import { TransactionList } from "./transactions/transaction-list";

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
  const [{ data: recentTransactions }, { data: categories }] = household
    ? await Promise.all([
        supabase.from("transactions").select("id, amount, type, category_id, merchant_name, transaction_date, spent_by, is_shared").eq("household_id", household.id).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(5),
        supabase.from("categories").select("id, name, sort_order, is_active, type").eq("household_id", household.id).order("sort_order"),
      ])
    : [{ data: [] }, { data: [] }];

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
        <>
          <section className="mt-10 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">현재 가계부</p><h2 className="mt-1 text-2xl font-bold">{household.name}</h2>
            <p className="mt-2 text-sm text-stone-600">{membership?.role === "owner" ? "관리자" : "구성원"} · {household.currency_code}</p>
            {membership?.role === "owner" && <InviteForm />}
          </section>
          <section className="mt-6 rounded-2xl bg-white px-4 py-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">최근 거래</h2>
              <Link href="/transactions" className="min-h-11 px-2 text-sm leading-[2.75rem] text-stone-600 underline underline-offset-4">전체 보기</Link>
            </div>
            <TransactionList transactions={recentTransactions ?? []} categories={categories ?? []} currentUserId={user.id} />
          </section>
          <Link href="/transactions/new" aria-label="새 거래 등록" className="mt-6 flex min-h-16 w-full items-center justify-center rounded-2xl bg-stone-900 text-lg font-bold text-white shadow-lg">+ 거래 등록</Link>
        </>
      )}
    </main>
  );
}
