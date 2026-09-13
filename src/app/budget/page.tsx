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
  searchParams: Promise<{ returnTo?: string | string[] }>;
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
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <RealtimeRefresh householdId={membership.household_id} includeTransactions={false} includeBudgets />
      <BackLink fallback={returnTo} />
      <h1 className="mt-4 text-2xl font-bold">예산·카테고리 설정</h1>
      <p className="mt-2 text-sm leading-6 text-stone-500">{month.monthLabel} 전체 예산은 지출 카테고리 예산을 합해 자동으로 계산합니다.</p>
      <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
        <BudgetForm
          key={formKey}
          categories={budgetCategories}
          preservedInactiveBudgetTotal={preservedInactiveBudgetTotal}
          legacyOverallAmount={totalBudget?.amount ?? null}
        />
      </section>
    </main>
  );
}
