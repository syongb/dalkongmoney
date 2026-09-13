"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BudgetSummary } from "@/app/budget/budget-summary";
import { buildMonthlyBudgetSummary, type MonthlyBudgetSummary } from "@/lib/budget";
import { getCurrentKoreaMonth, millisecondsUntilNextKoreaDay, type KoreaMonth } from "@/lib/korea-date";
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
  month?: KoreaMonth;
  initialBudgetSummary?: MonthlyBudgetSummary;
};

export function RealtimeTransactions({
  variant,
  householdId,
  initialTransactions,
  categories,
  members,
  month,
  initialBudgetSummary,
}: RealtimeTransactionsProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [budgetSummary, setBudgetSummary] = useState<MonthlyBudgetSummary>(
    initialBudgetSummary ?? { budgetAmount: null, spentAmount: 0, categories: [] },
  );
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

    if (variant === "home" && month) {
      const [transactionsResult, budgetResult, expensesResult] = await Promise.all([
        query,
        supabase
          .from("budgets")
          .select("amount, category_id")
          .eq("household_id", householdId)
          .eq("budget_month", month.monthStart),
        supabase
          .from("transactions")
          .select("amount, category_id")
          .eq("household_id", householdId)
          .eq("type", "expense")
          .gte("transaction_date", month.monthStart)
          .lt("transaction_date", month.nextMonthStart),
      ]);

      if (
        transactionsResult.error ||
        budgetResult.error ||
        expensesResult.error ||
        requestId !== latestRequestId.current
      ) return;

      setTransactions(transactionsResult.data ?? []);
      setBudgetSummary(buildMonthlyBudgetSummary(
        categories,
        budgetResult.data,
        expensesResult.data,
      ));
      return;
    }

    const { data, error } = await query;
    if (error || requestId !== latestRequestId.current) return;
    setTransactions(data ?? []);
  }, [categories, householdId, limit, month, supabase, variant]);

  useEffect(() => {
    let active = true;
    let transactionChannel: ReturnType<typeof supabase.channel> | null = null;
    let budgetChannel: ReturnType<typeof supabase.channel> | null = null;
    let subscribing = false;

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
      if (!active || subscribing) return;
      subscribing = true;

      try {
        await supabase.realtime.setAuth();
        if (!active) return;

        if (!transactionChannel) {
          transactionChannel = supabase
            .channel(`household:${householdId}:transactions`, {
              config: { private: true },
            })
            .on("broadcast", { event: "transaction_changed" }, requestRefresh)
            .subscribe((status) => {
              if (status === "SUBSCRIBED") requestRefresh();
            });
        }

        if (variant === "home" && !budgetChannel) {
          budgetChannel = supabase
            .channel(`household:${householdId}:budgets`, {
              config: { private: true },
            })
            .on("broadcast", { event: "budget_changed" }, requestRefresh)
            .subscribe((status) => {
              if (status === "SUBSCRIBED") requestRefresh();
            });
        }
      } catch {
        // Keep the current list. A later online/visibility event retries the connection.
      } finally {
        subscribing = false;
      }
    }

    function recover() {
      if (
        variant === "home" &&
        month &&
        getCurrentKoreaMonth().monthStart !== month.monthStart
      ) {
        router.refresh();
        return;
      }
      requestRefresh();
      if (!transactionChannel || (variant === "home" && !budgetChannel)) void subscribe();
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
      if (transactionChannel) void supabase.removeChannel(transactionChannel);
      if (budgetChannel) void supabase.removeChannel(budgetChannel);
    };
  }, [householdId, month, refreshTransactions, router, supabase, variant]);

  useEffect(() => {
    if (variant !== "home") return;
    const timer = window.setTimeout(() => {
      router.refresh();
    }, millisecondsUntilNextKoreaDay() + 1_000);
    return () => window.clearTimeout(timer);
  }, [month?.monthStart, router, variant]);

  if (variant === "home") {
    return (
      <>
        {month && <BudgetSummary month={month} summary={budgetSummary} />}
        <section className="mt-6 rounded-2xl bg-white px-4 py-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">최근 거래</h2>
            <Link href="/transactions" className="min-h-11 px-2 text-sm leading-[2.75rem] text-stone-600 underline underline-offset-4">전체 보기</Link>
          </div>
          <TransactionList transactions={transactions} categories={categories} members={members} />
        </section>
      </>
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
