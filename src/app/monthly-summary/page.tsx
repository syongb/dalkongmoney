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
      <li className="border-t border-stone-100 py-4 first:border-t-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{category.name}{category.isActive ? "" : " (비활성)"}</p>
            <p className="mt-1 text-sm text-stone-600">{won.format(category.spentAmount)}원</p>
          </div>
          <span className="text-sm font-medium text-stone-500">예산 미설정</span>
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
    <li className="border-t border-stone-100 py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{category.name}{category.isActive ? "" : " (비활성)"}</p>
          <p className="mt-1 text-sm text-stone-600">
            {won.format(category.spentAmount)}원 / 예산 {won.format(category.budgetAmount)}원
          </p>
          {over > 0 && <p className="mt-1 text-sm font-semibold text-red-700">{won.format(over)}원 초과</p>}
          {rate !== null && over <= 0 && <p className="mt-1 text-sm text-stone-600">{rate}% 사용</p>}
          {category.budgetAmount === 0 && category.spentAmount === 0 && <p className="mt-1 text-sm text-stone-600">예산 0원</p>}
        </div>
        <span className={`text-sm font-bold ${statusClass[status]}`}>{status}</span>
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
    { data: expenses },
    { data: incomes },
    { count: transactionCount },
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
      .select("amount, category_id, spent_by, is_shared")
      .eq("household_id", membership.household_id)
      .eq("type", "expense")
      .gte("transaction_date", month.monthStart)
      .lt("transaction_date", month.nextMonthStart),
    supabase
      .from("transactions")
      .select("amount")
      .eq("household_id", membership.household_id)
      .eq("type", "income")
      .gte("transaction_date", month.monthStart)
      .lt("transaction_date", month.nextMonthStart),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("household_id", membership.household_id)
      .gte("transaction_date", month.monthStart)
      .lt("transaction_date", month.nextMonthStart),
    getHouseholdMemberOptions(supabase, membership.household_id),
  ]);

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
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <RealtimeRefresh householdId={membership.household_id} includeBudgets />
      <BackLink fallback="/?view=transactions" />

      <header className="mt-5">
        <p className="text-sm text-stone-500">{month.year}년 {month.month}월</p>
        <h1 className="mt-1 text-2xl font-bold">이번 달 결산</h1>
      </header>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-stone-500">이번 달 총지출</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-red-700">{won.format(summary.spentAmount)}원</p>

        {budgetAmount === null ? (
          <div className="mt-6 rounded-xl bg-stone-50 p-4">
            <p className="text-sm text-stone-600">전체 예산이 설정되지 않았습니다.</p>
            <Link href="/budget" className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">예산 설정</Link>
          </div>
        ) : (
          <div className="mt-6 border-t border-stone-100 pt-5">
            <p className="text-sm text-stone-500">전체 예산 대비 사용액</p>
            <p className="mt-1 text-lg font-bold">{won.format(summary.spentAmount)}원 <span className="font-normal text-stone-500">/ {won.format(budgetAmount)}원</span></p>
            <p className={`mt-3 text-xl font-bold ${remaining !== null && remaining < 0 ? "text-red-700" : "text-stone-950"}`}>
              {remaining !== null && remaining < 0
                ? `${won.format(Math.abs(remaining))}원 초과`
                : `남은 금액 ${won.format(remaining ?? 0)}원`}
            </p>
            <p className={`mt-2 text-sm font-bold ${totalStatus ? statusClass[totalStatus] : ""}`}>
              {totalRate === null ? "예산 0원" : `${totalRate}% 사용`} · {totalStatus}
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">이번 달 가장 많이 쓴 카테고리</h2>
        {topCategory && topCategory.spentAmount > 0 ? (
          <div className="mt-4">
            <p className="text-xl font-bold">{topCategory.name}</p>
            <p className="mt-1 text-lg font-semibold text-red-700">{won.format(topCategory.spentAmount)}원</p>
            <p className="mt-1 text-sm text-stone-600">전체 지출의 {topCategoryShare}%</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">이번 달 지출이 아직 없습니다.</p>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">카테고리별 지출</h2>
        {visibleCategories.length > 0 ? (
          <ul className="mt-3">
            {visibleCategories.map((category) => <CategoryResult key={category.categoryId} category={category} />)}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone-500">표시할 카테고리 지출이나 예산이 없습니다.</p>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">사용자별·공동 지출</h2>
        <p className="mt-1 text-sm text-stone-500">이번 달 지출이 누구 기준으로 기록됐는지 보여주는 참고 정보입니다.</p>
        <dl className="mt-4 space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-4">
              <dt>{member.label}</dt>
              <dd className="font-semibold">{won.format(memberSpending.get(member.id) ?? 0)}원</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 border-t border-stone-100 pt-3">
            <dt>공동</dt>
            <dd className="font-semibold">{won.format(sharedSpending)}원</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">참고 정보</h2>
        <dl className="mt-4 space-y-3 text-sm">
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
