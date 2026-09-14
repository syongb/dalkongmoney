"use client";

import { useActionState, useMemo, useState } from "react";
import { importPreviousMonthBudgets, saveBudgetCategories, type BudgetActionState } from "./actions";

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
  isMonthEmpty,
}: {
  categories: BudgetCategoryInput[];
  preservedInactiveBudgetTotal: number;
  legacyOverallAmount: number | null;
  isMonthEmpty: boolean;
}) {
  const [state, action, pending] = useActionState(saveBudgetCategories, initialState);
  const [rows, setRows] = useState<EditableCategory[]>(() => categories.map((category) => ({
    ...category,
    key: category.id,
    originalAmount: category.amount,
    isActive: true,
  })));
  const [showEditor, setShowEditor] = useState(!isMonthEmpty);

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
    <form action={action} className="space-y-3">
      {!showEditor && (
        <section className="rounded-lg bg-stone-50 p-3">
          <p className="text-xs font-semibold">이번 달 카테고리 예산이 없습니다.</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">전월 금액을 가져오거나 빈 상태에서 새로 입력할 수 있습니다.</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button formAction={importPreviousMonthBudgets} className="min-h-10 rounded-lg border border-stone-900 bg-white px-2 text-xs font-semibold">전월 예산 가져오기</button>
            <button type="button" onClick={() => setShowEditor(true)} className="min-h-10 rounded-lg bg-stone-900 px-2 text-xs font-semibold text-white">새로 설정</button>
          </div>
        </section>
      )}
      {showEditor && (
      <section>
        <h2 className="text-sm font-bold">지출 카테고리와 월 예산</h2>
        <p className="mt-1 text-xs leading-5 text-stone-500">예산을 비워두면 이번 달 합계에 포함하지 않습니다.</p>
        <div className="mt-2 space-y-1.5">
          {rows.map((row) => row.isActive ? (
            <div key={row.key} className="rounded-lg border border-stone-200 p-2">
              <input type="hidden" name="category_id" value={row.id} />
              <input type="hidden" name="category_active" value="true" />
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-2">
              <label className="block min-w-0">
                <span className="sr-only">카테고리명</span>
                <input name="category_name" required maxLength={50} value={row.name} onChange={(event) => updateRow(row.key, { name: event.target.value })} placeholder="카테고리명" className="min-h-10 w-full min-w-0 rounded-md border border-stone-300 px-2 text-xs outline-none focus:border-stone-700" />
              </label>
              <label className="block min-w-0">
                <span className="sr-only">월 예산</span>
                <div className="flex items-center rounded-lg border border-stone-300 px-2 focus-within:border-stone-700">
                  <input name="category_amount" type="number" inputMode="numeric" min="0" step="1" value={row.amount ?? ""} onChange={(event) => updateRow(row.key, { amount: event.target.value === "" ? null : Number(event.target.value) })} placeholder="예산" className="min-h-10 min-w-0 flex-1 bg-transparent text-right text-xs font-bold outline-none" />
                  <span className="ml-1 text-xs font-medium">원</span>
                </div>
              </label>
              <button type="button" onClick={() => removeRow(row)} aria-label={`${row.name || "새 카테고리"} 삭제`} className="min-h-10 rounded-lg text-lg font-bold text-red-700">⋯</button>
              </div>
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
        <button type="button" onClick={addCategory} className="mt-2 min-h-10 w-full rounded-lg border border-dashed border-stone-400 bg-stone-50 text-xs font-semibold">+ 카테고리 추가</button>
      </section>
      )}

      {showEditor && (
      <section className="rounded-lg bg-stone-50 p-2.5 text-xs">
        <div className="flex justify-between gap-3">
          <span className="text-stone-500">총 예산 · 참고</span>
          <strong className="text-sm">{won.format(totalBudget)}원</strong>
        </div>
        {(preservedInactiveBudgetTotal + deletedBudgetTotal) > 0 && <p className="mt-2 text-xs leading-5 text-stone-500">비활성 카테고리에 이미 저장된 이번 달 예산 {won.format(preservedInactiveBudgetTotal + deletedBudgetTotal)}원이 포함되어 있습니다.</p>}
        {legacyOverallAmount !== null && categories.every((category) => category.amount === null) && <p className="mt-2 text-xs leading-5 text-amber-700">기존 전체 예산 {won.format(legacyOverallAmount)}원은 카테고리에 자동 배분하지 않습니다. 카테고리 예산을 저장하면 새 합계로 전환됩니다.</p>}
      </section>
      )}

      {state.message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{state.message}</p>}
      {showEditor && <button disabled={pending || rows.every((row) => !row.isActive)} className="min-h-10 w-full rounded-lg bg-stone-900 text-sm font-bold text-white disabled:opacity-50">{pending ? "저장하는 중…" : "저장"}</button>}
    </form>
  );
}
