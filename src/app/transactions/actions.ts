"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import type { TransactionType } from "@/lib/transactions";

export type TransactionActionState = { message: string };

type ParsedTransaction = {
  amount: number;
  type: TransactionType;
  categoryId: string;
  merchantName: string | null;
  memo: string | null;
  transactionDate: string;
  spentBy: string | null;
  isShared: boolean;
};

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseTransaction(formData: FormData):
  | { value: ParsedTransaction }
  | { error: string } {
  const amount = Number(String(formData.get("amount") ?? ""));
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { error: "금액은 1원 이상의 정수로 입력해주세요." };
  }

  const rawType = String(formData.get("type") ?? "expense");
  if (rawType !== "expense" && rawType !== "income") {
    return { error: "거래 유형을 다시 선택해주세요." };
  }

  const categoryId = String(formData.get("category_id") ?? "");
  if (!categoryId) return { error: "카테고리를 선택해주세요." };

  const merchantName = String(formData.get("merchant_name") ?? "").trim();
  if (merchantName.length > 100) {
    return { error: "상호명은 100자 이하로 입력해주세요." };
  }

  const memo = String(formData.get("memo") ?? "").trim();
  if (memo.length > 500) return { error: "메모는 500자 이하로 입력해주세요." };

  const transactionDate = String(formData.get("transaction_date") ?? "");
  if (!isValidDate(transactionDate)) {
    return { error: "거래 날짜를 다시 확인해주세요." };
  }

  const spender = String(formData.get("spender") ?? "");
  if (!spender) return { error: "소비자를 선택해주세요." };
  const isShared = spender === "shared";

  return {
    value: {
      amount,
      type: rawType,
      categoryId,
      merchantName: merchantName || null,
      memo: memo || null,
      transactionDate,
      spentBy: isShared ? null : spender,
      isShared,
    },
  };
}

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { supabase, user, error };
}

export async function createTransaction(
  _state: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const parsed = parseTransaction(formData);
  if ("error" in parsed) return { message: parsed.error };

  const { supabase, user, error: authError } = await authenticatedClient();
  if (authError || !user) return { message: "로그인 상태를 다시 확인해주세요." };

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) return { message: membershipError.message };
  if (!membership) return { message: "먼저 함께 쓸 가계부를 만들어주세요." };

  const value = parsed.value;
  const transaction: TablesInsert<"transactions"> = {
    household_id: membership.household_id,
    amount: value.amount,
    type: value.type,
    category_id: value.categoryId,
    merchant_name: value.merchantName,
    memo: value.memo,
    transaction_date: value.transactionDate,
    created_by: user.id,
    spent_by: value.spentBy,
    is_shared: value.isShared,
  };
  const { error } = await supabase.from("transactions").insert(transaction);
  if (error) return { message: error.message };

  revalidatePath("/");
  redirect("/");
}

export async function updateTransaction(
  transactionId: string,
  _state: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const parsed = parseTransaction(formData);
  if ("error" in parsed) return { message: parsed.error };

  const { supabase, user, error: authError } = await authenticatedClient();
  if (authError || !user) return { message: "로그인 상태를 다시 확인해주세요." };

  const value = parsed.value;
  const updates: TablesUpdate<"transactions"> = {
    amount: value.amount,
    type: value.type,
    category_id: value.categoryId,
    merchant_name: value.merchantName,
    memo: value.memo,
    transaction_date: value.transactionDate,
    spent_by: value.spentBy,
    is_shared: value.isShared,
  };
  const { data, error } = await supabase
    .from("transactions")
    .update(updates)
    .eq("id", transactionId)
    .select("id")
    .maybeSingle();
  if (error) return { message: error.message };
  if (!data) return { message: "수정할 거래를 찾을 수 없습니다." };

  revalidatePath("/transactions");
  redirect("/transactions");
}

export async function deleteTransaction(
  transactionId: string,
  _state: TransactionActionState,
  _formData: FormData,
): Promise<TransactionActionState> {
  void _state;
  void _formData;
  const { supabase, user, error: authError } = await authenticatedClient();
  if (authError || !user) return { message: "로그인 상태를 다시 확인해주세요." };

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .select("id")
    .maybeSingle();
  if (error) return { message: error.message };
  if (!data) return { message: "삭제할 거래를 찾을 수 없습니다." };

  revalidatePath("/transactions");
  redirect("/transactions");
}
