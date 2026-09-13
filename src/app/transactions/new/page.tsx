import { redirect } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { RealtimeRefresh } from "@/app/realtime-refresh";
import { createClient } from "@/lib/supabase/server";
import { getHouseholdMemberOptions } from "@/lib/household-members";
import { safeReturnTo } from "@/lib/navigation";
import { todayInKorea } from "@/lib/transactions";
import { TransactionForm } from "../transaction-form";

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo, "/");
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
      <RealtimeRefresh householdId={membership.household_id} includeTransactions={false} />
      <BackLink fallback={returnTo} />
      <h1 className="mt-2 text-xl font-bold">거래 등록</h1>
      <p className="mt-1 text-xs text-stone-500">금액과 카테고리만 선택해도 됩니다.</p>
      <div className="mt-3">
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
          cancelHref={returnTo}
        />
      </div>
    </main>
  );
}
