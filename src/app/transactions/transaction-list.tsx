import Link from "next/link";
import type { CategoryOption, MemberOption, TransactionListRow } from "@/lib/transactions";

export function TransactionList({
  transactions,
  categories,
  members,
  emptyMessage = "아직 등록된 거래가 없습니다.",
  showDate = true,
  returnTo,
}: {
  transactions: TransactionListRow[];
  categories: CategoryOption[];
  members: MemberOption[];
  emptyMessage?: string;
  showDate?: boolean;
  returnTo?: string;
}) {
  if (transactions.length === 0) {
    return <p className="rounded-lg bg-stone-100 px-3 py-3 text-center text-xs text-stone-500">{emptyMessage}</p>;
  }

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const memberNames = new Map(members.map((member) => [member.id, member.label]));

  return (
    <div className="divide-y divide-stone-200">
      {transactions.map((transaction) => {
        const spender = transaction.is_shared
          ? "공동"
          : memberNames.get(transaction.spent_by ?? "") ?? "구성원";
        const date = transaction.transaction_date.slice(5).replace("-", "/");
        const typeLabel = transaction.type === "income" ? "수입" : "지출";

        return (
          <Link key={transaction.id} href={`/transactions/${transaction.id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`} className={`grid min-h-11 items-center gap-2 py-0.5 ${showDate ? "grid-cols-[2.25rem_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]"}`}>
            {showDate && <span className="text-xs text-stone-500">{date}</span>}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{transaction.merchant_name ?? "상호명 없음"}</span>
              <span className="block truncate text-xs text-stone-500">{categoryNames.get(transaction.category_id) ?? "카테고리 없음"} · {spender} · {typeLabel}</span>
            </span>
            <span className={`whitespace-nowrap text-right text-sm font-semibold ${transaction.type === "income" ? "text-blue-700" : "text-red-700"}`}>
              {transaction.amount.toLocaleString("ko-KR")}원
            </span>
          </Link>
        );
      })}
    </div>
  );
}
