import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { getHouseholdMemberOptions } from "@/lib/household-members";
import { createClient } from "@/lib/supabase/server";
import { RealtimeTransactions } from "./realtime-transactions";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/transactions");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/");

  const [{ data: transactions }, { data: categories }, members] = await Promise.all([
    supabase.from("transactions").select("id, amount, type, category_id, merchant_name, transaction_date, spent_by, is_shared").eq("household_id", membership.household_id).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name, sort_order, is_active, type").eq("household_id", membership.household_id).order("sort_order"),
    getHouseholdMemberOptions(supabase, membership.household_id),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8 pb-28">
      <BackLink fallback="/?view=transactions" />
      <RealtimeTransactions
        variant="all"
        householdId={membership.household_id}
        initialTransactions={transactions ?? []}
        categories={categories ?? []}
        members={members}
      />
      <Link href="/transactions/new?returnTo=%2Ftransactions" aria-label="새 거래 등록" className="fixed bottom-6 left-1/2 flex min-h-16 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 items-center justify-center rounded-2xl bg-stone-900 text-lg font-bold text-white shadow-lg">+ 거래 등록</Link>
    </main>
  );
}
