"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { millisecondsUntilNextKoreaDay } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/client";

export function RealtimeRefresh({
  householdId,
  includeTransactions = true,
  includeBudgets = false,
  includeCategories = true,
}: {
  householdId: string;
  includeTransactions?: boolean;
  includeBudgets?: boolean;
  includeCategories?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    let subscribing = false;
    let transactionChannel: ReturnType<typeof supabase.channel> | null = null;
    let budgetChannel: ReturnType<typeof supabase.channel> | null = null;

    const requestRefresh = () => {
      if (!active) return;
      if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        router.refresh();
      }, 150);
    };

    async function subscribe() {
      if (!active || subscribing) return;
      subscribing = true;

      try {
        await supabase.realtime.setAuth();
        if (!active) return;

        if ((includeTransactions || includeCategories) && !transactionChannel) {
          transactionChannel = supabase
            .channel(`household:${householdId}:transactions`, { config: { private: true } })
          if (includeTransactions) transactionChannel.on("broadcast", { event: "transaction_changed" }, requestRefresh);
          if (includeCategories) transactionChannel.on("broadcast", { event: "category_changed" }, requestRefresh);
          transactionChannel.on("broadcast", { event: "household_changed" }, requestRefresh);
          transactionChannel.subscribe();
        }

        if (includeBudgets && !budgetChannel) {
          budgetChannel = supabase
            .channel(`household:${householdId}:budgets`, { config: { private: true } })
            .on("broadcast", { event: "budget_changed" }, requestRefresh)
          if (includeCategories) budgetChannel.on("broadcast", { event: "category_changed" }, requestRefresh);
          budgetChannel.on("broadcast", { event: "household_changed" }, requestRefresh);
          budgetChannel.subscribe();
        }
      } catch {
        // Keep the current screen. Online or visibility recovery retries later.
      } finally {
        subscribing = false;
      }
    }

    function recover() {
      requestRefresh();
      if (((includeTransactions || includeCategories) && !transactionChannel) || (includeBudgets && !budgetChannel)) void subscribe();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") recover();
    };

    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void subscribe();

    return () => {
      active = false;
      if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (transactionChannel) void supabase.removeChannel(transactionChannel);
      if (budgetChannel) void supabase.removeChannel(budgetChannel);
    };
  }, [householdId, includeBudgets, includeCategories, includeTransactions, router, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => router.refresh(), millisecondsUntilNextKoreaDay() + 1_000);
    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
