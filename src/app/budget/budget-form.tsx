"use client";

import { useActionState, useMemo, useState } from "react";
import { saveMonthlyBudget, type BudgetActionState } from "./actions";

const initialState: BudgetActionState = { message: "" };
const won = new Intl.NumberFormat("ko-KR");

type BudgetCategoryInput = {
  id: string;
  name: string;
  isActive: boolean;
  amount: number | null;
};

export function BudgetForm({
  initialAmount,
  categories,
}: {
  initialAmount: number | null;
  categories: BudgetCategoryInput[];
}) {
  const [state, action, pending] = useActionState(saveMonthlyBudget, initialState);
  const [totalAmount, setTotalAmount] = useState(initialAmount === null ? "" : String(initialAmount));
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, string>>(
    Object.fromEntries(categories.map((category) => [
      category.id,
      category.amount === null ? "" : String(category.amount),
    ])),
  );
  const allocation = useMemo(
    () => Object.values(categoryAmounts).reduce(
      (sum, value) => /^\d+$/.test(value) ? sum + Number(value) : sum,
      0,
    ),
    [categoryAmounts],
  );
  const parsedTotal = /^\d+$/.test(totalAmount) ? Number(totalAmount) : null;
  const overAllocated = parsedTotal !== null && allocation > parsedTotal;
  const unallocated = parsedTotal === null ? null : parsedTotal - allocation;

  return (
    <form action={action} className="space-y-7">
      <label className="block">
        <span className="text-sm font-semibold">전체 생활비</span>
        <div className="mt-2 flex items-center rounded-2xl border border-stone-300 bg-white px-4 focus-within:border-stone-700">
          <input
            name="amount"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            required
            autoFocus
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
            placeholder="0"
            className="min-h-16 min-w-0 flex-1 bg-transparent text-right text-3xl font-bold outline-none"
          />
          <span className="ml-2 text-lg font-semibold">원</span>
        </div>
        <span className="mt-2 block text-sm leading-6 text-stone-500">0원으로 저장할 수도 있습니다.</span>
      </label>

      <section>
        <h2 className="text-lg font-bold">카테고리별 예산</h2>
        <p className="mt-1 text-sm text-stone-500">선택 사항이며, 빈칸은 예산 미설정으로 저장됩니다.</p>
        <div className="mt-4 space-y-3">
          {categories.map((category) => (
            <label key={category.id} className="block rounded-xl border border-stone-200 p-3">
              <input type="hidden" name="category_id" value={category.id} />
              <span className="text-sm font-semibold">{category.name}{category.isActive ? "" : " (비활성)"}</span>
              <div className="mt-2 flex items-center rounded-xl border border-stone-300 bg-white px-3 focus-within:border-stone-700">
                <input
                  name="category_amount"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={categoryAmounts[category.id] ?? ""}
                  onChange={(event) => setCategoryAmounts((current) => ({
                    ...current,
                    [category.id]: event.target.value,
                  }))}
                  placeholder="예산 미설정"
                  className="min-h-12 min-w-0 flex-1 bg-transparent text-right text-lg font-bold outline-none"
                />
                <span className="ml-2 text-sm font-medium">원</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className={`rounded-xl p-4 ${overAllocated ? "bg-red-50 text-red-800" : "bg-stone-50"}`}>
        <div className="flex justify-between gap-3 text-sm">
          <span>배정 합계</span>
          <strong>{won.format(allocation)}원</strong>
        </div>
        <div className="mt-2 flex justify-between gap-3 text-sm">
          <span>{overAllocated ? "초과 배정" : "미배정"}</span>
          <strong>{won.format(Math.abs(unallocated ?? 0))}원</strong>
        </div>
        {overAllocated && <p className="mt-3 text-sm font-semibold">카테고리 예산을 줄이거나 전체 예산을 늘려주세요.</p>}
      </section>

      {state.message && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {state.message}
        </p>
      )}
      <button disabled={pending || parsedTotal === null || overAllocated} className="min-h-14 w-full rounded-2xl bg-stone-900 text-lg font-bold text-white disabled:opacity-50">
        {pending ? "저장하는 중…" : "예산 저장"}
      </button>
    </form>
  );
}
