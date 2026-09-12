"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryOption, MemberOption, TransactionListRow } from "@/lib/transactions";
import { TransactionList } from "./transaction-list";

const transactionColumns =
  "id, amount, type, category_id, merchant_name, transaction_date, spent_by, is_shared";

type RealtimeTransactionsProps = {
  variant: "home" | "all";
  householdId: string;
  initialTransactions: TransactionListRow[];
  categories: CategoryOption[];
  members: MemberOption[];
};

export function RealtimeTransactions({
  variant,
  householdId,
  initialTransactions,
  categories,
  members,
}: RealtimeTransactionsProps) {
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState(initialTransactions);
  const latestRequestId = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = variant === "home" ? 5 : null;

  const refreshTransactions = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    let query = supabase
      .from("transactions")
      .select(transactionColumns)
      .eq("household_id", householdId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (limit !== null) query = query.limit(limit);

    const { data, error } = await query;
    if (error || requestId !== latestRequestId.current) return;

    setTransactions(data ?? []);
  }, [householdId, limit, supabase]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const requestRefresh = () => {
      if (!active) return;
      latestRequestId.current += 1;
      if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        void refreshTransactions();
      }, 150);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") recover();
    };

    async function subscribe() {
      if (!active || channel) return;

      try {
        await supabase.realtime.setAuth();
        if (!active || channel) return;

        channel = supabase
          .channel(`household:${householdId}:transactions`, {
            config: { private: true },
          })
          .on(
            "broadcast",
            { event: "transaction_changed" },
            requestRefresh,
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") requestRefresh();
          });
      } catch {
        // Keep the current list. A later online/visibility event retries the connection.
      }
    }

    function recover() {
      requestRefresh();
      if (!channel) void subscribe();
    }

    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void subscribe();

    return () => {
      active = false;
      latestRequestId.current += 1;
      if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [householdId, refreshTransactions, supabase]);

  if (variant === "home") {
    return (
      <section className="mt-6 rounded-2xl bg-white px-4 py-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">최근 거래</h2>
          <Link href="/transactions" className="min-h-11 px-2 text-sm leading-[2.75rem] text-stone-600 underline underline-offset-4">전체 보기</Link>
        </div>
        <TransactionList transactions={transactions} categories={categories} members={members} />
      </section>
    );
  }

  return (
    <>
      <div className="mt-4 flex items-end justify-between">
        <div><p className="text-sm text-stone-500">우리 가계부</p><h1 className="text-2xl font-bold">거래 내역</h1></div>
        <span className="text-sm text-stone-500">{transactions.length}건</span>
      </div>
      <section className="mt-6 rounded-2xl bg-white px-4 shadow-sm">
        <TransactionList transactions={transactions} categories={categories} members={members} />
      </section>
    </>
  );
}
