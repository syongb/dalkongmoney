"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CategoryOption,
  MemberOption,
  TransactionFormValues,
} from "@/lib/transactions";
import {
  createTransaction,
  updateTransaction,
  type TransactionActionState,
} from "./actions";

const initialState: TransactionActionState = { message: "" };

type TransactionFormProps = {
  mode: "create" | "edit";
  householdId: string;
  currentUserId: string;
  categories: CategoryOption[];
  members: MemberOption[];
  initialValues: TransactionFormValues;
  transactionId?: string;
};

export function TransactionForm({
  mode,
  householdId,
  currentUserId,
  categories,
  members,
  initialValues,
  transactionId,
}: TransactionFormProps) {
  const updateAction = updateTransaction.bind(null, transactionId ?? "");
  const serverAction = mode === "create" ? createTransaction : updateAction;
  const [state, action, pending] = useActionState(serverAction, initialState);
  const [selectedType, setSelectedType] = useState(initialValues.type);
  const [categoryId, setCategoryId] = useState(initialValues.category_id);
  const [categoryWasChosen, setCategoryWasChosen] = useState(mode === "edit");
  const [merchantName, setMerchantName] = useState(initialValues.merchant_name ?? "");
  const [suggestion, setSuggestion] = useState("");
  const currentMember = members.find((member) => member.id === currentUserId);
  const spouse = members.find((member) => member.id !== currentUserId);
  const initialSpender = initialValues.is_shared
    ? "shared"
    : initialValues.spent_by ?? currentUserId;
  const typeLabel = selectedType === "income" ? "수입" : "지출";
  const visibleCategories = useMemo(
    () => categories.filter(
      (category) =>
        category.type === selectedType &&
        (category.is_active || category.id === initialValues.category_id),
    ),
    [categories, initialValues.category_id, selectedType],
  );

  function changeType(nextType: "expense" | "income") {
    setSelectedType(nextType);
    const categoryMatches = categories.some(
      (category) => category.id === categoryId && category.type === nextType,
    );
    if (!categoryMatches) {
      setCategoryId("");
      setCategoryWasChosen(true);
      setSuggestion("");
    }
  }

  useEffect(() => {
    if (mode !== "create" || categoryWasChosen) return;
    const normalizedMerchant = merchantName.trim();
    if (!normalizedMerchant) return;

    let ignored = false;
    const timer = window.setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("transactions")
        .select("category_id")
        .eq("household_id", householdId)
        .eq("merchant_name", normalizedMerchant)
        .eq("type", selectedType)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ignored || !data) return;
      const category = visibleCategories.find((item) => item.id === data.category_id);
      if (!category) return;
      setCategoryId(category.id);
      setSuggestion(`이전 기록을 보고 ${category.name}(으)로 선택했습니다.`);
    }, 350);

    return () => {
      ignored = true;
      window.clearTimeout(timer);
    };
  }, [categoryWasChosen, householdId, merchantName, mode, selectedType, visibleCategories]);

  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="text-sm font-semibold">거래 유형</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label
            className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold ${
              selectedType === "expense"
                ? "border-red-700 bg-red-50 text-red-700"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            <input
              type="radio"
              name="type"
              value="expense"
              checked={selectedType === "expense"}
              onChange={() => changeType("expense")}
              className="sr-only"
            />
            지출
          </label>
          <label
            className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold ${
              selectedType === "income"
                ? "border-blue-700 bg-blue-50 text-blue-700"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            <input
              type="radio"
              name="type"
              value="income"
              checked={selectedType === "income"}
              onChange={() => changeType("income")}
              className="sr-only"
            />
            수입
          </label>
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold">{typeLabel} 금액</span>
        <div className="mt-2 flex items-center rounded-2xl border border-stone-300 bg-white px-4 focus-within:border-stone-700">
          <input
            name="amount"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            required
            autoFocus={mode === "create"}
            defaultValue={initialValues.amount || ""}
            placeholder="0"
            className={`min-h-16 min-w-0 flex-1 bg-transparent text-right text-3xl font-bold outline-none ${selectedType === "income" ? "text-blue-700" : "text-red-700"}`}
          />
          <span className="ml-2 text-lg font-semibold">원</span>
        </div>
      </label>

      <label className="block">
        <span className="text-sm font-semibold">상호명 <span className="font-normal text-stone-500">선택</span></span>
        <input
          name="merchant_name"
          maxLength={100}
          value={merchantName}
          onChange={(event) => {
            setMerchantName(event.target.value);
            if (!categoryWasChosen) {
              setCategoryId("");
              setSuggestion("");
            }
          }}
          placeholder="예: 스타벅스"
          className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 outline-none focus:border-stone-700"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold">{typeLabel} 카테고리</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {visibleCategories.map((category) => (
            <label
              key={category.id}
              className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-medium ${
                categoryId === category.id
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="category_id"
                value={category.id}
                checked={categoryId === category.id}
                onChange={() => {
                  setCategoryId(category.id);
                  setCategoryWasChosen(true);
                  setSuggestion("");
                }}
                required
                className="sr-only"
              />
              {category.name}{category.is_active ? "" : " (비활성)"}
            </label>
          ))}
        </div>
        {suggestion && <p className="mt-2 text-sm text-emerald-700">{suggestion}</p>}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">누가 썼나요?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <SpenderOption value={currentUserId} label={currentMember?.label ?? "구성원"} defaultChecked={initialSpender === currentUserId} />
          <SpenderOption
            value={spouse?.id ?? ""}
            label={spouse?.label ?? "구성원"}
            defaultChecked={Boolean(spouse && initialSpender === spouse.id)}
            disabled={!spouse}
          />
          <SpenderOption value="shared" label="공동" defaultChecked={initialSpender === "shared"} />
        </div>
      </fieldset>

      <details className="rounded-xl border border-stone-200 bg-white p-4" open={mode === "edit"}>
        <summary className="cursor-pointer text-sm font-semibold">추가 옵션 · 날짜 / 메모</summary>
        <div className="mt-5 space-y-5">
          <label className="block text-sm font-medium">날짜
            <input name="transaction_date" type="date" required defaultValue={initialValues.transaction_date} className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 px-3" />
          </label>
          <label className="block text-sm font-medium">메모 <span className="font-normal text-stone-500">선택</span>
            <textarea name="memo" maxLength={500} defaultValue={initialValues.memo ?? ""} rows={3} className="mt-2 w-full rounded-xl border border-stone-300 p-3" />
          </label>
        </div>
      </details>

      {state.message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{state.message}</p>}
      <button disabled={pending || visibleCategories.length === 0} className="min-h-14 w-full rounded-2xl bg-stone-900 px-4 text-lg font-bold text-white disabled:opacity-50">
        {pending ? "저장하는 중…" : mode === "create" ? "저장" : "수정 저장"}
      </button>
      <Link href={mode === "create" ? "/" : "/transactions"} className="block min-h-11 text-center text-sm leading-[2.75rem] text-stone-600 underline underline-offset-4">취소</Link>
    </form>
  );
}

function SpenderOption({
  value,
  label,
  defaultChecked,
  disabled = false,
}: {
  value: string;
  label: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-sm font-medium ${disabled ? "opacity-40" : "cursor-pointer"}`}>
      <input type="radio" name="spender" value={value} defaultChecked={defaultChecked} disabled={disabled} required />
      {label}
    </label>
  );
}
