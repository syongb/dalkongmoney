import Link from "next/link";
import type { CategoryBudgetSummary, MonthlyBudgetSummary } from "@/lib/budget";
import type { KoreaMonth } from "@/lib/korea-date";

const won = new Intl.NumberFormat("ko-KR");

type BudgetStatus = {
  label: "여유" | "주의" | "위험" | "초과";
  textClass: string;
  barClass: string;
};

function budgetStatus(spent: number, budget: number): BudgetStatus {
  if (spent > budget) return { label: "초과", textClass: "text-red-700", barClass: "bg-red-700" };
  const rate = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  if (rate >= 85) return { label: "위험", textClass: "text-orange-700", barClass: "bg-orange-600" };
  if (rate >= 60) return { label: "주의", textClass: "text-amber-700", barClass: "bg-amber-500" };
  return { label: "여유", textClass: "text-emerald-700", barClass: "bg-emerald-600" };
}

function StatusProgress({ spent, budget }: { spent: number; budget: number }) {
  const status = budgetStatus(spent, budget);
  const rate = budget > 0 ? Math.round((spent / budget) * 100) : null;

  if (budget === 0) {
    return (
      <p className={`mt-2 text-sm font-semibold ${status.textClass}`}>
        {spent > 0 ? `${won.format(spent)}원 초과 · 초과` : "예산 0원"}
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-label={`예산 사용률 ${rate}% · ${status.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(rate ?? 0, 100)}>
        <div className={`h-full rounded-full ${status.barClass}`} style={{ width: `${Math.min(rate ?? 0, 100)}%` }} />
      </div>
      <p className={`mt-2 text-sm font-semibold ${status.textClass}`}>
        {spent > budget ? `${won.format(spent - budget)}원 초과 · ` : `${rate}% 사용 · `}{status.label}
      </p>
    </div>
  );
}

function CategoryBudgetRow({ category }: { category: CategoryBudgetSummary }) {
  const status = category.budgetAmount === null
    ? null
    : budgetStatus(category.spentAmount, category.budgetAmount);

  return (
    <li className="border-t border-stone-100 py-4 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{category.name}{category.isActive ? "" : " (비활성)"}</p>
        {status ? (
          <span className={`text-sm font-bold ${status.textClass}`}>{status.label}</span>
        ) : (
          <span className="text-sm font-medium text-stone-500">예산 미설정</span>
        )}
      </div>
      {category.budgetAmount === null ? (
        <p className="mt-1 text-sm text-stone-600">이번 달 사용 {won.format(category.spentAmount)}원</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-stone-600">{won.format(category.spentAmount)}원 / {won.format(category.budgetAmount)}원</p>
          <StatusProgress spent={category.spentAmount} budget={category.budgetAmount} />
        </>
      )}
    </li>
  );
}

export function BudgetSummary({
  month,
  summary,
}: {
  month: KoreaMonth;
  summary: MonthlyBudgetSummary;
}) {
  const { budgetAmount, spentAmount, categories } = summary;

  if (budgetAmount === null) {
    return (
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">{month.monthLabel}</h2>
        <p className="mt-6 text-sm text-stone-500">이번 달 사용</p>
        <p className="mt-1 text-3xl font-bold text-red-700">{won.format(spentAmount)}원</p>
        <div className="mt-6 rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
          아직 월 예산이 없습니다.<br />
          예산을 설정하면 남은 금액과 하루 평균 사용 가능 금액을 계산해드립니다.
        </div>
        <Link href="/budget" className="mt-5 flex min-h-12 items-center justify-center rounded-xl border border-stone-900 font-semibold">
          이번 달 예산 설정
        </Link>
      </section>
    );
  }

  const remaining = budgetAmount - spentAmount;
  const isOver = remaining < 0;
  const dailyAvailable = remaining > 0
    ? Math.floor(remaining / month.daysRemaining)
    : 0;

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">{month.monthLabel}</h2>
        <Link href="/budget" className="min-h-11 px-2 text-sm leading-[2.75rem] text-stone-600 underline underline-offset-4">예산 수정</Link>
      </div>

      <p className="mt-5 text-sm font-medium text-stone-500">{isOver ? "예산보다" : "남은 금액"}</p>
      <p className={`mt-1 text-4xl font-bold tracking-tight ${isOver ? "text-red-700" : "text-stone-950"}`}>
        {won.format(Math.abs(remaining))}원{isOver ? " 초과" : ""}
      </p>

      <div className="mt-7 border-t border-stone-100 pt-5">
        <p className="text-sm text-stone-500">이번 달 사용</p>
        <p className="mt-1 text-lg font-bold">
          <span className="text-red-700">{won.format(spentAmount)}원</span>
          <span className="font-normal text-stone-500"> / {won.format(budgetAmount)}원</span>
        </p>
        <StatusProgress spent={spentAmount} budget={budgetAmount} />
      </div>

      <div className="mt-5 rounded-xl bg-stone-50 p-4">
        <p className="text-sm text-stone-600">오늘 포함 {month.daysRemaining}일 남음</p>
        <p className="mt-1 text-sm text-stone-600">하루 평균 사용 가능 금액</p>
        <p className="mt-1 text-xl font-bold">{won.format(dailyAvailable)}원</p>
      </div>

      <details className="mt-5 border-t border-stone-100 pt-4">
        <summary className="min-h-11 cursor-pointer font-semibold leading-[2.75rem]">카테고리별 현황</summary>
        <ul>
          {categories.map((category) => <CategoryBudgetRow key={category.categoryId} category={category} />)}
        </ul>
      </details>
    </section>
  );
}
