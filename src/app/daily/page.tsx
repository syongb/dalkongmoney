import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { RealtimeRefresh } from "@/app/realtime-refresh";
import { TransactionList } from "@/app/transactions/transaction-list";
import { getHouseholdMemberOptions } from "@/lib/household-members";
import { formatKoreaDateLabel, isValidDateValue, shiftDateValue } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/server";
import { sumAmounts } from "@/lib/budget";
import { safeReturnTo } from "@/lib/navigation";
import { todayInKorea } from "@/lib/transactions";

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[]; returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const today = todayInKorea();
  const selectedDate = isValidDateValue(requestedDate) ? requestedDate : today;
  const returnTo = safeReturnTo(params.returnTo, "/?view=transactions");
  const returnQuery = `&returnTo=${encodeURIComponent(returnTo)}`;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/daily?date=${selectedDate}`);

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/");

  const [{ data: transactions }, { data: categories }, members] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount, type, category_id, merchant_name, transaction_date, spent_by, is_shared")
      .eq("household_id", membership.household_id)
      .eq("transaction_date", selectedDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("id, name, sort_order, is_active, type")
      .eq("household_id", membership.household_id)
      .order("sort_order"),
    getHouseholdMemberOptions(supabase, membership.household_id),
  ]);

  const rows = transactions ?? [];
  const expenseTotal = sumAmounts(rows.filter((transaction) => transaction.type === "expense"));
  const incomeTotal = sumAmounts(rows.filter((transaction) => transaction.type === "income"));
  const isToday = selectedDate === today;

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <RealtimeRefresh householdId={membership.household_id} />
      <BackLink fallback={returnTo} />

      <nav aria-label="날짜 이동" className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Link href={`/daily?date=${shiftDateValue(selectedDate, -1)}${returnQuery}`} className="flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold shadow-sm">이전 날</Link>
        <p className="px-2 text-center font-bold">{formatKoreaDateLabel(selectedDate)}</p>
        <Link href={`/daily?date=${shiftDateValue(selectedDate, 1)}${returnQuery}`} className="flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold shadow-sm">다음 날</Link>
      </nav>

      {!isToday && (
        <div className="mt-3 text-center">
          <Link href={`/daily?returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-11 items-center px-4 text-sm text-stone-600 underline underline-offset-4">오늘로 이동</Link>
        </div>
      )}

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-stone-500">{isToday ? "오늘 지출" : "이날 지출"}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-red-700">{expenseTotal.toLocaleString("ko-KR")}원</p>
        <p className="mt-4 text-sm text-stone-600">
          수입 <span className="font-semibold text-blue-700">{incomeTotal.toLocaleString("ko-KR")}원</span> · 거래 {rows.length}건
        </p>
      </section>

      <section className="mt-6 rounded-2xl bg-white px-4 py-5 shadow-sm">
        <h1 className="mb-3 text-lg font-bold">{isToday ? "오늘 거래" : "이날 거래"}</h1>
        <TransactionList
          transactions={rows}
          categories={categories ?? []}
          members={members}
          emptyMessage="이날 등록된 거래가 없습니다."
          showDate={false}
          returnTo={`/daily?date=${selectedDate}&returnTo=${encodeURIComponent(returnTo)}`}
        />
      </section>
    </main>
  );
}
