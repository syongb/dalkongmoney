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
      <li className="border-t border-stone-100 py-3 first:border-t-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{category.name}{category.isActive ? "" : " (비활성)"}</p>
            <p className="text-xs text-stone-600">{won.format(category.spentAmount)}원 사용</p>
          </div>
          <span className="text-sm font-medium text-stone-500">예산 미설정</span>
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
    <li className="border-t border-stone-100 py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="min-w-0 truncate font-semibold">{category.name}{category.isActive ? "" : " (비활성)"}</p>
        <p className="shrink-0 text-xs text-stone-600">{won.format(spent)} / {won.format(budget)}원</p>
        <span className={`shrink-0 text-xs font-bold ${style.text}`}>{rate === null ? "0원" : `${rate}%`} · {status}</span>
      </div>
      <div className="mt-2 h-1.5 w-2/3 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-label={`${category.name} 예산 ${rate === null ? "0원" : `${rate}% 사용`} · ${status}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={visualRate}>
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${visualRate}%` }} />
      </div>
      {budget === 0 ? (
        <p className={`mt-1 text-xs font-semibold ${style.text}`}>{spent > 0 ? `${won.format(over)}원 초과 · 초과` : "예산 0원 · 여유"}</p>
      ) : over > 0 ? (
        <p className={`mt-1 text-xs font-semibold ${style.text}`}>{won.format(over)}원 초과 · 초과</p>
      ) : null}
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
  const totalStatus = budgetAmount === null ? null : getBudgetStatus(spentAmount, budgetAmount);
  const totalRate = budgetAmount && budgetAmount > 0 ? Math.round((spentAmount / budgetAmount) * 100) : null;

  return (
    <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">{month.monthLabel}</h2>
      <p className="mt-1 text-xs text-stone-500">카테고리별 이번 달 예산과 사용액입니다.</p>

      <ul className="mt-2">
        {categories.map((category) => <CategoryBudgetRow key={category.categoryId} category={category} />)}
      </ul>

      <div className="mt-4 border-t border-stone-200 pt-5">
        <h3 className="font-bold">이번 달 전체</h3>
        {budgetAmount === null ? (
          <div className="mt-4 rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
            <p>현재 지출 <strong className="text-red-700">{won.format(spentAmount)}원</strong></p>
            <p className="mt-2">설정된 카테고리 예산이 없습니다.</p>
          </div>
        ) : (
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-stone-600">총 예산</dt><dd className="font-semibold">{won.format(budgetAmount)}원</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-stone-600">현재 지출</dt><dd className="font-semibold text-red-700">{won.format(spentAmount)}원</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-stone-600">{remaining !== null && remaining < 0 ? "초과 금액" : "남은 금액"}</dt><dd className={`font-semibold ${remaining !== null && remaining < 0 ? "text-red-700" : ""}`}>{won.format(Math.abs(remaining ?? 0))}원</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-stone-600">전체 상태</dt><dd className={`font-semibold ${totalStatus ? statusStyle[totalStatus].text : ""}`}>{totalRate === null ? "예산 0원" : `${totalRate}%`} · {totalStatus}</dd></div>
            <div className="border-t border-stone-100 pt-3"><dt className="text-stone-600">오늘 더 사용할 수 있는 금액</dt><dd className="mt-1 text-xl font-bold">{won.format(todayAvailable ?? 0)}원</dd><p className="mt-1 text-xs text-stone-500">오늘 사용 {won.format(todaySpentAmount)}원 반영 · 오늘 포함 {month.daysRemaining}일</p></div>
          </dl>
        )}
      </div>

      <Link href="/budget?returnTo=%2F%3Fview%3Dbudget" className="mt-6 flex min-h-12 items-center justify-center rounded-xl border border-stone-900 font-semibold">예산·카테고리 설정</Link>
    </section>
  );
}
