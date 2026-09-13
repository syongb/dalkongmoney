import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentKoreaMonth } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/server";
import { BudgetForm } from "./budget-form";

export default async function BudgetPage() {
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
    .filter((category) => category.is_active || categoryBudgetAmounts.has(category.id))
    .map((category) => ({
      id: category.id,
      name: category.name,
      isActive: category.is_active,
      amount: categoryBudgetAmounts.get(category.id) ?? null,
    }));

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link href="/" className="text-sm text-stone-600">← 홈</Link>
      <h1 className="mt-4 text-2xl font-bold">{month.monthLabel} 설정</h1>
      <p className="mt-2 text-sm leading-6 text-stone-500">두 구성원이 함께 보는 전체 생활비와 지출 카테고리 예산입니다.</p>
      <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
        <BudgetForm initialAmount={totalBudget?.amount ?? null} categories={budgetCategories} />
      </section>
    </main>
  );
}
