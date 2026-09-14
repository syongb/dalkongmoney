"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BudgetSummary } from "@/app/budget/budget-summary";
import { buildMonthlyBudgetSummary, type MonthlyBudgetSummary } from "@/lib/budget";
import { getCurrentKoreaMonth, millisecondsUntilNextKoreaDay, type KoreaMonth } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/client";
import { todayInKorea, type CategoryOption, type MemberOption, type TransactionListRow } from "@/lib/transactions";
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
  initialHomeTab?: "budget" | "transactions";
  initialBudgetSummary?: MonthlyBudgetSummary;
};

export function RealtimeTransactions({
  variant,
  householdId,
  initialTransactions,
  categories,
  members,
  month,
  initialHomeTab = "budget",
  initialBudgetSummary,
}: RealtimeTransactionsProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [budgetSummary, setBudgetSummary] = useState<MonthlyBudgetSummary>(
    initialBudgetSummary ?? { budgetAmount: null, spentAmount: 0, todaySpentAmount: 0, categories: [] },
  );
  const [homeTab, setHomeTab] = useState<"budget" | "transactions">(initialHomeTab);
  const latestRequestId = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
          .select("amount, category_id, transaction_date")
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
        todayInKorea(),
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

    const requestServerRefresh = () => {
      if (!active) return;
      if (serverRefreshTimer.current !== null) clearTimeout(serverRefreshTimer.current);
      serverRefreshTimer.current = setTimeout(() => {
        serverRefreshTimer.current = null;
        router.refresh();
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
            .on("broadcast", { event: "category_changed" }, requestServerRefresh)
            .on("broadcast", { event: "household_changed" }, requestServerRefresh)
            .subscribe();
        }

        if (variant === "home" && !budgetChannel) {
          budgetChannel = supabase
            .channel(`household:${householdId}:budgets`, {
              config: { private: true },
            })
            .on("broadcast", { event: "budget_changed" }, requestRefresh)
            .on("broadcast", { event: "category_changed" }, requestServerRefresh)
            .on("broadcast", { event: "household_changed" }, requestServerRefresh)
            .subscribe();
        }
      } catch {
        // Keep the current list. A later online/visibility event retries the connection.
      } finally {
        subscribing = false;
      }
    }

    async function reconnect() {
      if (!active) return;
      const channels = [transactionChannel, budgetChannel].filter(
        (channel): channel is NonNullable<typeof channel> => channel !== null,
      );
      transactionChannel = null;
      budgetChannel = null;
      await Promise.all(channels.map((channel) => supabase.removeChannel(channel)));
      if (active) await subscribe();
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
      void reconnect();
    }

    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void subscribe();

    return () => {
      active = false;
      latestRequestId.current += 1;
      if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
      if (serverRefreshTimer.current !== null) clearTimeout(serverRefreshTimer.current);
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
    const selectHomeTab = (nextTab: "budget" | "transactions") => {
      setHomeTab(nextTab);
      window.history.replaceState(null, "", `/?view=${nextTab}`);
    };

    return (
      <>
        <div role="tablist" aria-label="홈 보기 선택" className="mt-2 grid grid-cols-2 rounded-lg bg-stone-200 p-0.5">
          <button type="button" role="tab" aria-selected={homeTab === "budget"} onClick={() => selectHomeTab("budget")} className={`min-h-10 rounded-md text-xs font-semibold ${homeTab === "budget" ? "bg-white shadow-sm" : "text-stone-600"}`}>예산</button>
          <button type="button" role="tab" aria-selected={homeTab === "transactions"} onClick={() => selectHomeTab("transactions")} className={`min-h-10 rounded-md text-xs font-semibold ${homeTab === "transactions" ? "bg-white shadow-sm" : "text-stone-600"}`}>거래 내역</button>
        </div>

        {homeTab === "budget" ? (
          month && <BudgetSummary month={month} summary={budgetSummary} />
        ) : (
          <>
            <nav aria-label="거래 내역 조회" className="mt-2 grid grid-cols-3 gap-1.5">
              <Link href="/weekly" className="flex min-h-10 items-center justify-center rounded-lg bg-white px-1 text-center text-xs font-semibold shadow-sm">주간</Link>
              <Link href="/calendar" className="flex min-h-10 items-center justify-center rounded-lg bg-white px-1 text-center text-xs font-semibold shadow-sm">달력</Link>
              <Link href="/monthly-summary" className="flex min-h-10 items-center justify-center rounded-lg bg-white px-1 text-center text-xs font-semibold shadow-sm">월간 결산</Link>
            </nav>
            <section className="mt-2 rounded-lg bg-white px-3 py-2 shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-sm font-bold">최근 거래</h2>
                <Link href="/transactions" className="min-h-10 px-1 text-xs leading-10 text-stone-600 underline underline-offset-4">전체 보기</Link>
              </div>
              <TransactionList transactions={transactions} categories={categories} members={members} returnTo="/?view=transactions" />
            </section>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div className="mt-2 flex items-end justify-between">
        <div><p className="text-xs text-stone-500">우리 가계부</p><h1 className="text-xl font-bold">거래 내역</h1></div>
        <span className="text-xs text-stone-500">{transactions.length}건</span>
      </div>
      <section className="mt-3 rounded-lg bg-white px-3 shadow-sm">
        <TransactionList transactions={transactions} categories={categories} members={members} />
      </section>
    </>
  );
}
