import type { Tables } from "@/lib/supabase/database.types";

export type TransactionType = "expense" | "income";

export type CategoryOption = Pick<
  Tables<"categories">,
  "id" | "name" | "sort_order" | "is_active" | "type"
>;

export type MemberOption = {
  id: string;
  label: "나" | "배우자";
};

export type TransactionFormValues = Pick<
  Tables<"transactions">,
  | "amount"
  | "category_id"
  | "merchant_name"
  | "memo"
  | "transaction_date"
  | "spent_by"
  | "is_shared"
> & { type: TransactionType };

export type TransactionListRow = Pick<
  Tables<"transactions">,
  | "id"
  | "amount"
  | "type"
  | "category_id"
  | "merchant_name"
  | "transaction_date"
  | "spent_by"
  | "is_shared"
>;

export function transactionType(value: string): TransactionType {
  return value === "income" ? "income" : "expense";
}

export function todayInKorea() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
