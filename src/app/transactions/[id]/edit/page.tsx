import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { transactionType, type MemberOption } from "@/lib/transactions";
import { DeleteTransactionForm } from "../../delete-transaction-form";
import { TransactionForm } from "../../transaction-form";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/transactions/${encodeURIComponent(id)}/edit`);

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/");

  const [{ data: transaction }, { data: categories }, { data: householdMembers }] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", id).eq("household_id", membership.household_id).maybeSingle(),
    supabase.from("categories").select("id, name, sort_order, is_active, type").eq("household_id", membership.household_id).order("sort_order"),
    supabase.from("household_members").select("user_id").eq("household_id", membership.household_id),
  ]);
  if (!transaction) notFound();

  const members: MemberOption[] = (householdMembers ?? []).map(({ user_id }) => ({
    id: user_id,
    label: user_id === user.id ? "나" : "배우자",
  }));
  const creator = transaction.created_by === user.id ? "나" : "배우자";
  const createdAt = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(transaction.created_at));

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link href="/transactions" className="text-sm text-stone-600">← 거래 내역</Link>
      <h1 className="mt-4 text-2xl font-bold">거래 수정</h1>
      <p className="mt-2 text-sm text-stone-500">처음 등록: {creator} · {createdAt}</p>
      <div className="mt-8">
        <TransactionForm
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
        />
        <DeleteTransactionForm transactionId={transaction.id} />
      </div>
    </main>
  );
}
