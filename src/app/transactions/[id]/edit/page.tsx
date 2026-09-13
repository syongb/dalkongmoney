import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { RealtimeRefresh } from "@/app/realtime-refresh";
import { getHouseholdMemberOptions } from "@/lib/household-members";
import { safeReturnTo } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";
import { transactionType } from "@/lib/transactions";
import { DeleteTransactionForm } from "../../delete-transaction-form";
import { TransactionForm } from "../../transaction-form";

export default async function EditTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo, "/transactions");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/transactions/${encodeURIComponent(id)}/edit`);

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/");

  const [{ data: transaction }, { data: categories }, members] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", id).eq("household_id", membership.household_id).maybeSingle(),
    supabase.from("categories").select("id, name, sort_order, is_active, type").eq("household_id", membership.household_id).order("sort_order"),
    getHouseholdMemberOptions(supabase, membership.household_id),
  ]);
  if (!transaction) notFound();

  const creator = members.find((member) => member.id === transaction.created_by)?.label ?? "구성원";
  const createdAt = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(transaction.created_at));

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <RealtimeRefresh householdId={membership.household_id} includeTransactions={false} />
      <BackLink fallback={returnTo} />
      <h1 className="mt-4 text-2xl font-bold">거래 수정</h1>
      <p className="mt-2 text-sm text-stone-500">처음 등록: {creator} · {createdAt}</p>
      <div className="mt-8">
        <TransactionForm
          key={categories?.map((category) => `${category.id}:${category.name}:${category.is_active}`).join("|")}
          mode="edit"
          transactionId={transaction.id}
          householdId={membership.household_id}
          currentUserId={user.id}
          categories={categories ?? []}
          members={members}
          initialValues={{
            amount: transaction.amount,
            type: transactionType(transaction.type),
            category_id: transaction.category_id,
            merchant_name: transaction.merchant_name,
            memo: transaction.memo,
            transaction_date: transaction.transaction_date,
            spent_by: transaction.spent_by,
            is_shared: transaction.is_shared,
          }}
          cancelHref={returnTo}
        />
        <DeleteTransactionForm transactionId={transaction.id} />
      </div>
    </main>
  );
}
