import Link from "next/link";
import { getBudgetStatus, type BudgetStatusLabel, type CategoryBudgetSummary, type MonthlyBudgetSummary } from "@/lib/budget";
import type { KoreaMonth } from "@/lib/korea-date";

const won = new Intl.NumberFormat("ko-KR");

const statusStyle: Record<BudgetStatusLabel, { text: string; bar: string }> = {
  여유: { text: "text-emerald-700", bar: "bg-emerald-600" },
  주의: { text: "text-amber-700", bar: "bg-amber-500" },
  위험: { text: "text-orange-700", bar: "bg-orange-600" },
  초과: { text: "text-red-700", bar: "bg-red-700" },
};

function CategoryBudgetRow({ category }: { category: CategoryBudgetSummary }) {
  if (category.budgetAmount === null) {
    return (
      <li className="border-t border-stone-100 py-1.5 first:border-t-0">
        <div className="flex items-center justify-between gap-2 text-xs">
          <p className="min-w-0 truncate font-semibold">{category.name}{category.isActive ? "" : " (비활성)"}</p>
          <p className="shrink-0 text-stone-600">{won.format(category.spentAmount)}원 사용</p>
          <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-500">미설정</span>
        </div>
      </li>
    );
  }

  const budget = category.budgetAmount;
  const spent = category.spentAmount;
  const status = getBudgetStatus(spent, budget);
  const rate = budget > 0 ? Math.round((spent / budget) * 100) : null;
  const visualRate = rate === null ? (spent > 0 ? 100 : 0) : Math.min(rate, 100);
  const over = Math.max(0, spent - budget);
  const style = statusStyle[status];

  return (
    <li className="border-t border-stone-100 py-1.5 first:border-t-0">
      <div className="flex items-center justify-between gap-1.5 text-xs">
        <p className="min-w-0 truncate font-semibold">{category.name}{category.isActive ? "" : " (비활성)"}</p>
        <p className="shrink-0 text-stone-600">{won.format(spent)}/{won.format(budget)}</p>
        <span className={`shrink-0 rounded px-1.5 py-0.5 font-bold ${style.text} bg-current/10`}>
          {budget === 0 ? (spent > 0 ? "초과" : "예산 0원") : `${rate}% · ${status}`}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 w-1/2 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-label={`${category.name} 예산 ${rate === null ? "0원" : `${rate}% 사용`} · ${status}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={visualRate}>
          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${visualRate}%` }} />
        </div>
        {budget === 0 && spent > 0 ? (
          <p className={`text-[0.68rem] font-semibold ${style.text}`}>{won.format(over)}원 초과</p>
        ) : over > 0 ? (
          <p className={`text-[0.68rem] font-semibold ${style.text}`}>{won.format(over)}원 초과</p>
        ) : null}
      </div>
    </li>
  );
}

export function BudgetSummary({ month, summary }: { month: KoreaMonth; summary: MonthlyBudgetSummary }) {
  const { budgetAmount, spentAmount, todaySpentAmount } = summary;
  const categories = summary.categories.filter((category) => category.isActive || category.budgetAmount !== null || category.spentAmount > 0);
  const remaining = budgetAmount === null ? null : budgetAmount - spentAmount;
  const todayAvailable = budgetAmount === null
    ? null
    : Math.max(0, Math.floor(((remaining ?? 0) + todaySpentAmount) / month.daysRemaining) - todaySpentAmount);

  return (
    <section className="mt-2 rounded-lg bg-white p-2.5 shadow-sm">
      <h2 className="text-sm font-bold">{month.monthLabel}</h2>

      <ul className="mt-2">
        {categories.map((category) => <CategoryBudgetRow key={category.categoryId} category={category} />)}
      </ul>

      <div className="mt-1 border-t border-stone-200 pt-2">
        <h3 className="text-xs font-bold text-stone-500">이번 달 합계 · 참고</h3>
        {budgetAmount === null ? (
          <div className="mt-2 rounded-lg bg-stone-50 p-2.5 text-xs leading-5 text-stone-600">
            <p>현재 지출 <strong className="text-red-700">{won.format(spentAmount)}원</strong></p>
            <p>설정된 카테고리 예산이 없습니다.</p>
          </div>
        ) : (
          <dl className="mt-1 space-y-1 text-xs">
            <div className="flex justify-between gap-4"><dt className="text-stone-600">카테고리 예산 합계</dt><dd className="font-semibold">{won.format(budgetAmount)}원</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-stone-600">현재 지출</dt><dd className="font-semibold text-red-700">{won.format(spentAmount)}원</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-stone-600">{remaining !== null && remaining < 0 ? "초과 금액" : "남은 금액"}</dt><dd className={`font-semibold ${remaining !== null && remaining < 0 ? "text-red-700" : ""}`}>{won.format(Math.abs(remaining ?? 0))}원</dd></div>
            <div className="flex items-center justify-between border-t border-stone-100 pt-2"><dt className="text-stone-600">오늘 더 사용 가능</dt><dd className="text-base font-bold">{won.format(todayAvailable ?? 0)}원</dd></div>
          </dl>
        )}
      </div>

      <Link href="/budget?returnTo=%2F%3Fview%3Dbudget" className="mt-2 flex min-h-10 items-center justify-center rounded-lg border border-stone-900 text-xs font-semibold">예산·카테고리 설정</Link>
    </section>
  );
}
