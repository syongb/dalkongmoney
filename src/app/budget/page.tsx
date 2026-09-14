import { redirect } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { RealtimeRefresh } from "@/app/realtime-refresh";
import { getCurrentKoreaMonth } from "@/lib/korea-date";
import { safeReturnTo } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";
import { BudgetForm } from "./budget-form";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[]; import?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo, "/?view=budget");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/budget");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/");

  const month = getCurrentKoreaMonth();
  const [{ data: budgets }, { data: categories }] = await Promise.all([
    supabase
      .from("budgets")
      .select("amount, category_id")
      .eq("household_id", membership.household_id)
      .eq("budget_month", month.monthStart),
    supabase
      .from("categories")
      .select("id, name, is_active, sort_order")
      .eq("household_id", membership.household_id)
      .eq("type", "expense")
      .order("sort_order"),
  ]);
  const totalBudget = (budgets ?? []).find((budget) => budget.category_id === null);
  const categoryBudgetAmounts = new Map(
    (budgets ?? [])
      .filter((budget) => budget.category_id !== null)
      .map((budget) => [budget.category_id as string, budget.amount]),
  );
  const budgetCategories = (categories ?? [])
    .filter((category) => category.is_active)
    .map((category) => ({
      id: category.id,
      name: category.name,
      amount: categoryBudgetAmounts.get(category.id) ?? null,
    }));
  const inactiveCategoryIds = new Set((categories ?? []).filter((category) => !category.is_active).map((category) => category.id));
  const preservedInactiveBudgetTotal = (budgets ?? []).reduce((sum, budget) => (
    budget.category_id && inactiveCategoryIds.has(budget.category_id)
      ? sum + Number(budget.amount)
      : sum
  ), 0);
  const formKey = JSON.stringify({ budgetCategories, preservedInactiveBudgetTotal });

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-5">
      <RealtimeRefresh householdId={membership.household_id} includeTransactions={false} includeBudgets />
      <BackLink fallback={returnTo} />
      <h1 className="mt-2 text-lg font-bold">예산·카테고리 설정</h1>
      <p className="mt-1 text-xs leading-5 text-stone-500">{month.monthLabel} · 카테고리 예산 합계가 전체 예산입니다.</p>
      {(Array.isArray(params.import) ? params.import[0] : params.import) === "empty" && (
        <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">가져올 전월 카테고리 예산이 없습니다. 새로 설정해주세요.</p>
      )}
      <section className="mt-2 rounded-lg bg-white p-2.5 shadow-sm">
        <BudgetForm
          key={formKey}
          categories={budgetCategories}
          preservedInactiveBudgetTotal={preservedInactiveBudgetTotal}
          legacyOverallAmount={totalBudget?.amount ?? null}
          isMonthEmpty={(budgets ?? []).every((budget) => budget.category_id === null)}
        />
      </section>
    </main>
  );
}
