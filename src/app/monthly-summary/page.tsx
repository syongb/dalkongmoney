import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { RealtimeRefresh } from "@/app/realtime-refresh";
import { buildMonthlyBudgetSummary, getBudgetStatus, sumAmounts, type BudgetStatusLabel, type CategoryBudgetSummary } from "@/lib/budget";
import { getHouseholdMemberOptions } from "@/lib/household-members";
import { getCurrentKoreaMonth } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/server";

const won = new Intl.NumberFormat("ko-KR");

const statusClass: Record<BudgetStatusLabel, string> = {
  여유: "text-emerald-700",
  주의: "text-amber-700",
  위험: "text-orange-700",
  초과: "text-red-700",
};

function CategoryResult({ category }: { category: CategoryBudgetSummary }) {
  if (category.budgetAmount === null) {
    return (
      <li className="border-t border-stone-100 py-1.5 first:border-t-0">
        <div className="flex items-center justify-between gap-2 text-xs">
          <p className="min-w-0 truncate font-semibold">{category.name}{category.isActive ? "" : " (비활성)"}</p>
          <p className="shrink-0 text-stone-600">{won.format(category.spentAmount)}원</p>
          <span className="shrink-0 text-stone-500">미설정</span>
        </div>
      </li>
    );
  }

  const status = getBudgetStatus(category.spentAmount, category.budgetAmount);
  const rate = category.budgetAmount > 0
    ? Math.round((category.spentAmount / category.budgetAmount) * 100)
    : null;
  const over = category.spentAmount - category.budgetAmount;

  return (
    <li className="border-t border-stone-100 py-1.5 first:border-t-0">
      <div className="flex items-center justify-between gap-1.5 text-xs">
        <p className="min-w-0 truncate font-semibold">{category.name}{category.isActive ? "" : " (비활성)"}</p>
        <p className="shrink-0 text-stone-600">{won.format(category.spentAmount)}/{won.format(category.budgetAmount)}</p>
        <span className={`shrink-0 font-bold ${statusClass[status]}`}>
          {category.budgetAmount === 0
            ? category.spentAmount > 0 ? `${won.format(over)}원 초과` : "예산 0원"
            : over > 0 ? `${won.format(over)}원 초과 · ${status}` : `${rate}% · ${status}`}
        </span>
      </div>
    </li>
  );
}

export default async function MonthlySummaryPage() {
  const month = getCurrentKoreaMonth();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/monthly-summary");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/");

  const [
    { data: categories },
    { data: budgets },
    { data: monthlyTransactions },
    members,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, sort_order, is_active, type")
      .eq("household_id", membership.household_id)
      .order("sort_order"),
    supabase
      .from("budgets")
      .select("amount, category_id")
      .eq("household_id", membership.household_id)
      .eq("budget_month", month.monthStart),
    supabase
      .from("transactions")
      .select("amount, type, category_id, spent_by, is_shared")
      .eq("household_id", membership.household_id)
      .gte("transaction_date", month.monthStart)
      .lt("transaction_date", month.nextMonthStart),
    getHouseholdMemberOptions(supabase, membership.household_id),
  ]);

  const expenses = (monthlyTransactions ?? []).filter((transaction) => transaction.type === "expense");
  const incomes = (monthlyTransactions ?? []).filter((transaction) => transaction.type === "income");
  const transactionCount = monthlyTransactions?.length ?? 0;
  const summary = buildMonthlyBudgetSummary(categories ?? [], budgets, expenses);
  const incomeTotal = sumAmounts(incomes);
  const visibleCategories = summary.categories.filter(
    (category) => category.spentAmount > 0 || category.budgetAmount !== null,
  );
  const topCategory = summary.categories.reduce<CategoryBudgetSummary | null>(
    (top, category) => !top || category.spentAmount > top.spentAmount ? category : top,
    null,
  );
  const topCategoryShare = topCategory && summary.spentAmount > 0
    ? Math.round((topCategory.spentAmount / summary.spentAmount) * 100)
    : 0;

  const memberSpending = new Map(members.map((member) => [member.id, 0]));
  let sharedSpending = 0;
  for (const expense of expenses ?? []) {
    if (expense.is_shared) {
      sharedSpending += Number(expense.amount);
    } else if (expense.spent_by) {
      memberSpending.set(
        expense.spent_by,
        (memberSpending.get(expense.spent_by) ?? 0) + Number(expense.amount),
      );
    }
  }

  const budgetAmount = summary.budgetAmount;
  const remaining = budgetAmount === null ? null : budgetAmount - summary.spentAmount;
  const totalStatus = budgetAmount === null ? null : getBudgetStatus(summary.spentAmount, budgetAmount);
  const totalRate = budgetAmount && budgetAmount > 0
    ? Math.round((summary.spentAmount / budgetAmount) * 100)
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-5">
      <RealtimeRefresh householdId={membership.household_id} includeBudgets />
      <BackLink fallback="/?view=transactions" />

      <header className="mt-2 flex items-end justify-between">
        <h1 className="text-xl font-bold">이번 달 결산</h1>
        <p className="text-xs text-stone-500">{month.year}.{month.month}</p>
      </header>

      <section className="mt-2 rounded-lg bg-white p-2.5 shadow-sm">
        <div className="flex items-center justify-between"><p className="text-xs font-medium text-stone-500">총지출</p><p className="text-xl font-bold text-red-700">{won.format(summary.spentAmount)}원</p></div>

        {budgetAmount === null ? (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-stone-50 p-2 text-xs">
            <p className="text-stone-600">카테고리 예산 미설정</p>
            <Link href="/budget" className="flex min-h-10 items-center font-semibold underline underline-offset-4">설정</Link>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-stone-100 pt-2 text-xs">
            <p>사용/예산 <strong>{won.format(summary.spentAmount)}/{won.format(budgetAmount)}</strong></p>
            <p className={`text-right font-bold ${remaining !== null && remaining < 0 ? "text-red-700" : "text-stone-950"}`}>
              {remaining !== null && remaining < 0
                ? `${won.format(Math.abs(remaining))}원 초과`
                : `남은 금액 ${won.format(remaining ?? 0)}원`}
            </p>
            <p className={`col-span-2 text-right font-bold ${totalStatus ? statusClass[totalStatus] : ""}`}>
              {totalRate === null
                ? summary.spentAmount > 0 ? `${won.format(summary.spentAmount)}원 초과` : "예산 0원"
                : `${totalRate}% 사용 · ${totalStatus}`}
            </p>
          </div>
        )}
      </section>

      <section className="mt-2 rounded-lg bg-white p-2.5 shadow-sm">
        <h2 className="text-sm font-bold">가장 많이 쓴 카테고리</h2>
        {topCategory && topCategory.spentAmount > 0 ? (
          <div className="mt-1 flex items-center justify-between gap-2 text-xs">
            <p className="font-bold">{topCategory.name}</p>
            <p className="font-semibold text-red-700">{won.format(topCategory.spentAmount)}원</p>
            <p className="text-stone-600">{topCategoryShare}%</p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-stone-500">이번 달 지출이 아직 없습니다.</p>
        )}
      </section>

      <section className="mt-2 rounded-lg bg-white p-2.5 shadow-sm">
        <h2 className="text-sm font-bold">카테고리별 지출</h2>
        {visibleCategories.length > 0 ? (
          <ul className="mt-2">
            {visibleCategories.map((category) => <CategoryResult key={category.categoryId} category={category} />)}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-stone-500">표시할 카테고리 지출이나 예산이 없습니다.</p>
        )}
      </section>

      <section className="mt-2 rounded-lg bg-white p-2.5 shadow-sm">
        <h2 className="text-sm font-bold">사용자별·공동 지출</h2>
        <dl className="mt-2 space-y-1.5 text-xs">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-4">
              <dt>{member.label}</dt>
              <dd className="font-semibold">{won.format(memberSpending.get(member.id) ?? 0)}원</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 border-t border-stone-100 pt-1.5">
            <dt>공동</dt>
            <dd className="font-semibold">{won.format(sharedSpending)}원</dd>
          </div>
        </dl>
      </section>

      <section className="mt-2 rounded-lg bg-white p-2.5 shadow-sm">
        <h2 className="text-sm font-bold">참고 정보</h2>
        <dl className="mt-2 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-stone-600">이번 달 총수입</dt>
            <dd className="font-semibold text-blue-700">{won.format(incomeTotal)}원</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-stone-600">전체 거래</dt>
            <dd className="font-semibold">{transactionCount ?? 0}건</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
