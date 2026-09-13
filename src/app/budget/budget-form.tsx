"use client";

import { useActionState, useMemo, useState } from "react";
import { saveBudgetCategories, type BudgetActionState } from "./actions";

const initialState: BudgetActionState = { message: "" };
const won = new Intl.NumberFormat("ko-KR");

type BudgetCategoryInput = {
  id: string;
  name: string;
  amount: number | null;
};

type EditableCategory = BudgetCategoryInput & {
  key: string;
  originalAmount: number | null;
  isActive: boolean;
};

export function BudgetForm({
  categories,
  preservedInactiveBudgetTotal,
  legacyOverallAmount,
}: {
  categories: BudgetCategoryInput[];
  preservedInactiveBudgetTotal: number;
  legacyOverallAmount: number | null;
}) {
  const [state, action, pending] = useActionState(saveBudgetCategories, initialState);
  const [rows, setRows] = useState<EditableCategory[]>(() => categories.map((category) => ({
    ...category,
    key: category.id,
    originalAmount: category.amount,
    isActive: true,
  })));

  const activeBudgetTotal = useMemo(() => rows.reduce((sum, row) => {
    if (!row.isActive || row.amount === null || !Number.isSafeInteger(Number(row.amount))) return sum;
    return sum + Number(row.amount);
  }, 0), [rows]);
  const deletedBudgetTotal = useMemo(() => rows.reduce((sum, row) => {
    if (row.isActive || !row.id || row.originalAmount === null) return sum;
    return sum + Number(row.originalAmount);
  }, 0), [rows]);
  const totalBudget = activeBudgetTotal + preservedInactiveBudgetTotal + deletedBudgetTotal;

  function updateRow(key: string, change: Partial<EditableCategory>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...change } : row));
  }

  function removeRow(row: EditableCategory) {
    if (!window.confirm(`'${row.name || "새 카테고리"}' 카테고리를 삭제할까요?\n\n기존 거래와 예산 기록은 유지됩니다.\n새 거래에서는 사용할 수 없습니다.`)) return;
    if (!row.id) {
      setRows((current) => current.filter((item) => item.key !== row.key));
      return;
    }
    updateRow(row.key, { isActive: false });
  }

  function addCategory() {
    const key = `new-${Date.now()}-${rows.length}`;
    setRows((current) => [...current, {
      id: "",
      key,
      name: "",
      amount: null,
      originalAmount: null,
      isActive: true,
    }]);
  }

  return (
    <form action={action} className="space-y-7">
      <section>
        <h2 className="text-lg font-bold">지출 카테고리와 월 예산</h2>
        <p className="mt-1 text-sm leading-6 text-stone-500">예산을 비워두면 카테고리만 사용하고 이번 달 예산에는 포함하지 않습니다.</p>
        <div className="mt-4 space-y-4">
          {rows.map((row) => row.isActive ? (
            <div key={row.key} className="rounded-2xl border border-stone-200 p-4">
              <input type="hidden" name="category_id" value={row.id} />
              <input type="hidden" name="category_active" value="true" />
              <label className="block">
                <span className="text-sm font-semibold">카테고리명</span>
                <input name="category_name" required maxLength={50} value={row.name} onChange={(event) => updateRow(row.key, { name: event.target.value })} placeholder="예: 반려동물" className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 px-3 outline-none focus:border-stone-700" />
              </label>
              <label className="mt-4 block">
                <span className="text-sm font-semibold">월 예산 <span className="font-normal text-stone-500">선택</span></span>
                <div className="mt-2 flex items-center rounded-xl border border-stone-300 px-3 focus-within:border-stone-700">
                  <input name="category_amount" type="number" inputMode="numeric" min="0" step="1" value={row.amount ?? ""} onChange={(event) => updateRow(row.key, { amount: event.target.value === "" ? null : Number(event.target.value) })} placeholder="예산 미설정" className="min-h-12 min-w-0 flex-1 bg-transparent text-right text-lg font-bold outline-none" />
                  <span className="ml-2 text-sm font-medium">원</span>
                </div>
              </label>
              <button type="button" onClick={() => removeRow(row)} className="mt-3 min-h-11 px-2 text-sm font-semibold text-red-700 underline underline-offset-4">삭제</button>
            </div>
          ) : (
            <div key={row.key}>
              <input type="hidden" name="category_id" value={row.id} />
              <input type="hidden" name="category_name" value={row.name} />
              <input type="hidden" name="category_amount" value="" />
              <input type="hidden" name="category_active" value="false" />
            </div>
          ))}
        </div>
        <button type="button" onClick={addCategory} className="mt-4 min-h-12 w-full rounded-xl border border-dashed border-stone-400 bg-stone-50 font-semibold">+ 카테고리 추가</button>
      </section>

      <section className="rounded-xl bg-stone-50 p-4">
        <div className="flex justify-between gap-3">
          <span className="font-semibold">총 예산</span>
          <strong className="text-xl">{won.format(totalBudget)}원</strong>
        </div>
        {(preservedInactiveBudgetTotal + deletedBudgetTotal) > 0 && <p className="mt-2 text-xs leading-5 text-stone-500">비활성 카테고리에 이미 저장된 이번 달 예산 {won.format(preservedInactiveBudgetTotal + deletedBudgetTotal)}원이 포함되어 있습니다.</p>}
        {legacyOverallAmount !== null && categories.every((category) => category.amount === null) && <p className="mt-2 text-xs leading-5 text-amber-700">기존 전체 예산 {won.format(legacyOverallAmount)}원은 카테고리에 자동 배분하지 않습니다. 카테고리 예산을 저장하면 새 합계로 전환됩니다.</p>}
      </section>

      {state.message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{state.message}</p>}
      <button disabled={pending || rows.every((row) => !row.isActive)} className="min-h-14 w-full rounded-2xl bg-stone-900 text-lg font-bold text-white disabled:opacity-50">{pending ? "저장하는 중…" : "저장"}</button>
    </form>
  );
}
