import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { RealtimeRefresh } from "@/app/realtime-refresh";
import { getKoreaMonth, shiftKoreaMonth } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/server";
import { todayInKorea } from "@/lib/transactions";

const won = new Intl.NumberFormat("ko-KR");
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const month = getKoreaMonth(requestedMonth);
  const today = todayInKorea();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/calendar?month=${month.monthStart.slice(0, 7)}`);

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/");

  const { data: expenses } = await supabase
    .from("transactions")
    .select("amount, transaction_date")
    .eq("household_id", membership.household_id)
    .eq("type", "expense")
    .gte("transaction_date", month.monthStart)
    .lt("transaction_date", month.nextMonthStart);

  const dailySpending = new Map<string, number>();
  for (const expense of expenses ?? []) {
    dailySpending.set(
      expense.transaction_date,
      (dailySpending.get(expense.transaction_date) ?? 0) + Number(expense.amount),
    );
  }

  const leadingBlanks = new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay();
  const monthValue = month.monthStart.slice(0, 7);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <RealtimeRefresh householdId={membership.household_id} />
      <BackLink fallback="/?view=transactions" />

      <nav aria-label="월 이동" className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Link href={`/calendar?month=${shiftKoreaMonth(month.monthStart, -1)}`} className="flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold shadow-sm">이전 달</Link>
        <h1 className="px-2 text-center text-lg font-bold">{month.year}년 {month.month}월</h1>
        <Link href={`/calendar?month=${shiftKoreaMonth(month.monthStart, 1)}`} className="flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold shadow-sm">다음 달</Link>
      </nav>

      <div className="mt-3 text-center">
        <Link href="/calendar" aria-current={monthValue === today.slice(0, 7) ? "date" : undefined} className="inline-flex min-h-11 items-center px-4 text-sm text-stone-600 underline underline-offset-4">오늘</Link>
      </div>

      <section className="mt-6 rounded-2xl bg-white p-3 shadow-sm">
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-stone-500">
          {weekdays.map((weekday) => <div key={weekday} className="py-2">{weekday}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }, (_, index) => <div key={`blank-${index}`} />)}
          {Array.from({ length: month.daysInMonth }, (_, index) => {
            const day = index + 1;
            const date = `${monthValue}-${twoDigits(day)}`;
            const spent = dailySpending.get(date) ?? 0;
            const isToday = date === today;
            return (
              <Link
                key={date}
                href={`/daily?date=${date}&returnTo=${encodeURIComponent(`/calendar?month=${monthValue}`)}`}
                aria-label={`${month.month}월 ${day}일 지출 ${won.format(spent)}원`}
                className={`flex min-h-20 min-w-0 flex-col rounded-lg px-1 py-2 text-center ${isToday ? "bg-stone-900 text-white" : "bg-stone-50 hover:bg-stone-100"}`}
              >
                <span className="text-sm font-semibold">{day}</span>
                {spent > 0 && <span className={`mt-2 truncate text-[0.68rem] font-semibold ${isToday ? "text-red-200" : "text-red-700"}`}>{won.format(spent)}</span>}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
