import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionList } from "./transaction-list";

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

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    supabase.from("transactions").select("id, amount, type, category_id, merchant_name, transaction_date, spent_by, is_shared").eq("household_id", membership.household_id).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name, sort_order, is_active, type").eq("household_id", membership.household_id).order("sort_order"),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8 pb-28">
      <Link href="/" className="text-sm text-stone-600">← 홈</Link>
      <div className="mt-4 flex items-end justify-between">
        <div><p className="text-sm text-stone-500">우리 가계부</p><h1 className="text-2xl font-bold">거래 내역</h1></div>
        <span className="text-sm text-stone-500">{transactions?.length ?? 0}건</span>
      </div>
      <section className="mt-6 rounded-2xl bg-white px-4 shadow-sm">
        <TransactionList transactions={transactions ?? []} categories={categories ?? []} currentUserId={user.id} />
      </section>
      <Link href="/transactions/new" aria-label="새 거래 등록" className="fixed bottom-6 left-1/2 flex min-h-16 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 items-center justify-center rounded-2xl bg-stone-900 text-lg font-bold text-white shadow-lg">+ 거래 등록</Link>
    </main>
  );
}
