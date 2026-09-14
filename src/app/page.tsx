import { redirect } from "next/navigation";
import Link from "next/link";
import { buildMonthlyBudgetSummary } from "@/lib/budget";
import { getHouseholdMemberOptions } from "@/lib/household-members";
import { getCurrentKoreaMonth } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/server";
import { todayInKorea } from "@/lib/transactions";
import { CreateHouseholdForm, InviteForm } from "./action-forms";
import { signOut } from "./actions";
import { RealtimeTransactions } from "./transactions/realtime-transactions";

type Membership = { role: "owner" | "member"; households: { id: string; name: string; currency_code: string } | { id: string; name: string; currency_code: string }[] | null };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedView = Array.isArray(params.view) ? params.view[0] : params.view;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: rawMembership }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("household_members").select("role, households(id, name, currency_code)").eq("user_id", user.id).maybeSingle(),
  ]);
  const membership = rawMembership as Membership | null;
  const household = Array.isArray(membership?.households) ? membership.households[0] : membership?.households;
  const month = getCurrentKoreaMonth();
  const today = todayInKorea();
  const [{ data: recentTransactions }, { data: categories }, members, { data: budgets }, { data: expenses }] = household
    ? await Promise.all([
        supabase.from("transactions").select("id, amount, type, category_id, merchant_name, transaction_date, spent_by, is_shared").eq("household_id", household.id).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(5),
        supabase.from("categories").select("id, name, sort_order, is_active, type").eq("household_id", household.id).order("sort_order"),
        getHouseholdMemberOptions(supabase, household.id),
        supabase.from("budgets").select("amount, category_id").eq("household_id", household.id).eq("budget_month", month.monthStart),
        supabase.from("transactions").select("amount, category_id, transaction_date").eq("household_id", household.id).eq("type", "expense").gte("transaction_date", month.monthStart).lt("transaction_date", month.nextMonthStart),
      ])
    : [{ data: [] }, { data: [] }, [], { data: null }, { data: [] }];

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-5">
      <header className="flex items-center justify-between">
        <div className="min-w-0"><p className="text-xs text-stone-500">안녕하세요</p><h1 className="truncate text-lg font-bold">{profile?.display_name ?? user.email}</h1></div>
        <div className="flex items-center gap-1">
          <Link href="/settings" className="min-h-10 px-2 text-xs leading-10 underline">설정</Link>
          <form action={signOut}><button className="min-h-10 px-2 text-xs underline">로그아웃</button></form>
        </div>
      </header>
      {!household ? (
        <section className="mt-12 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">함께 쓸 가계부 만들기</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">먼저 가계부를 만든 다음 일회용 링크로 배우자를 초대할 수 있습니다.</p>
          <CreateHouseholdForm />
        </section>
      ) : (
        <>
          <section className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-stone-500">우리 가계부</p>
              <h2 className="truncate text-lg font-bold">{household.name}</h2>
            </div>
            <Link href={`/transactions/new?returnTo=${encodeURIComponent(requestedView === "transactions" ? "/?view=transactions" : "/?view=budget")}`} className="flex min-h-10 shrink-0 items-center rounded-lg bg-stone-900 px-3 text-xs font-bold text-white">＋ 등록</Link>
          </section>
          <RealtimeTransactions
            key={`${month.monthStart}:${(categories ?? []).map((category) => `${category.id}:${category.name}:${category.is_active}`).join("|")}`}
            variant="home"
            householdId={household.id}
            initialTransactions={recentTransactions ?? []}
            categories={categories ?? []}
            members={members}
            month={month}
            initialHomeTab={requestedView === "transactions" ? "transactions" : "budget"}
            initialBudgetSummary={buildMonthlyBudgetSummary(categories ?? [], budgets, expenses, today)}
          />
          <details className="mt-2 rounded-lg bg-white p-2.5 shadow-sm">
            <summary className="min-h-10 cursor-pointer text-sm font-semibold leading-10">가계부 정보</summary>
            <p className="mt-1 text-xs text-stone-600">{membership?.role === "owner" ? "관리자" : "구성원"} · {household.currency_code}</p>
            {membership?.role === "owner" && <InviteForm />}
          </details>
        </>
      )}
    </main>
  );
}
