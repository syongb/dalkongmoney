import Link from "next/link";
import type { CategoryOption, TransactionListRow } from "@/lib/transactions";

export function TransactionList({
  transactions,
  categories,
  currentUserId,
  emptyMessage = "아직 등록된 거래가 없습니다.",
}: {
  transactions: TransactionListRow[];
  categories: CategoryOption[];
  currentUserId: string;
  emptyMessage?: string;
}) {
  if (transactions.length === 0) {
    return <p className="rounded-xl bg-stone-100 px-4 py-8 text-center text-sm text-stone-500">{emptyMessage}</p>;
  }

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <div className="divide-y divide-stone-200">
      {transactions.map((transaction) => {
        const spender = transaction.is_shared
          ? "공동"
          : transaction.spent_by === currentUserId
            ? "나"
            : "배우자";
        const date = transaction.transaction_date.slice(5).replace("-", "/");
        const typeLabel = transaction.type === "income" ? "수입" : "지출";

        return (
          <Link key={transaction.id} href={`/transactions/${transaction.id}/edit`} className="grid min-h-16 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-2">
            <span className="text-xs text-stone-500">{date}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{transaction.merchant_name ?? "상호명 없음"}</span>
              <span className="block truncate text-xs text-stone-500">{categoryNames.get(transaction.category_id) ?? "카테고리 없음"} · {spender} · {typeLabel}</span>
            </span>
            <span className={`whitespace-nowrap text-right font-semibold ${transaction.type === "income" ? "text-blue-700" : "text-red-700"}`}>
              {transaction.amount.toLocaleString("ko-KR")}원
            </span>
          </Link>
        );
      })}
    </div>
  );
}
