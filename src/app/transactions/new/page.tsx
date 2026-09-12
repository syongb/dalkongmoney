import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHouseholdMemberOptions } from "@/lib/household-members";
import { todayInKorea } from "@/lib/transactions";
import { TransactionForm } from "../transaction-form";

export default async function NewTransactionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/transactions/new");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/");

  const [{ data: categories }, members] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order, is_active, type").eq("household_id", membership.household_id).eq("is_active", true).order("sort_order"),
    getHouseholdMemberOptions(supabase, membership.household_id),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link href="/" className="text-sm text-stone-600">← 홈</Link>
      <h1 className="mt-4 text-2xl font-bold">거래 등록</h1>
      <p className="mt-2 text-sm text-stone-500">금액과 카테고리만 선택해도 저장할 수 있습니다.</p>
      <div className="mt-8">
        <TransactionForm
          mode="create"
          householdId={membership.household_id}
          currentUserId={user.id}
          categories={categories ?? []}
          members={members}
          initialValues={{
            amount: 0,
            type: "expense",
            category_id: "",
            merchant_name: null,
            memo: null,
            transaction_date: todayInKorea(),
            spent_by: user.id,
            is_shared: false,
          }}
        />
      </div>
    </main>
  );
}
