import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { RealtimeRefresh } from "@/app/realtime-refresh";
import { isValidDateValue, shiftDateValue } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/server";
import { todayInKorea } from "@/lib/transactions";

const won = new Intl.NumberFormat("ko-KR");
const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"];

function mondayOf(value: string) {
  const date = new Date(Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  ));
  const weekday = date.getUTCDay();
  return shiftDateValue(value, weekday === 0 ? -6 : 1 - weekday);
}

function shortDate(value: string) {
  return `${Number(value.slice(5, 7))}월 ${Number(value.slice(8, 10))}일`;
}

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedStart = Array.isArray(params.start) ? params.start[0] : params.start;
  const today = todayInKorea();
  const weekStart = mondayOf(isValidDateValue(requestedStart) ? requestedStart : today);
  const weekEnd = shiftDateValue(weekStart, 6);
  const nextWeekStart = shiftDateValue(weekStart, 7);
  const currentWeekStart = mondayOf(today);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/weekly?start=${weekStart}`);

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
    .gte("transaction_date", weekStart)
    .lt("transaction_date", nextWeekStart);

  const dailySpending = new Map<string, number>();
  let weeklyTotal = 0;
  for (const expense of expenses ?? []) {
    const amount = Number(expense.amount);
    weeklyTotal += amount;
    dailySpending.set(
      expense.transaction_date,
      (dailySpending.get(expense.transaction_date) ?? 0) + amount,
    );
  }

  const days = Array.from({ length: 7 }, (_, index) => shiftDateValue(weekStart, index));

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <RealtimeRefresh householdId={membership.household_id} />
      <BackLink fallback="/?view=transactions" />

      <nav aria-label="주 이동" className="mt-5 grid grid-cols-2 gap-2">
        <Link href={`/weekly?start=${shiftDateValue(weekStart, -7)}`} className="flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold shadow-sm">이전 주</Link>
        <Link href={`/weekly?start=${nextWeekStart}`} className="flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold shadow-sm">다음 주</Link>
      </nav>
      <div className="mt-4 text-center">
        <h1 className="text-xl font-bold">{shortDate(weekStart)} ~ {shortDate(weekEnd)}</h1>
        <Link href="/weekly" aria-current={weekStart === currentWeekStart ? "date" : undefined} className="mt-1 inline-flex min-h-11 items-center px-4 text-sm text-stone-600 underline underline-offset-4">이번 주</Link>
      </div>

      <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-stone-500">이번 주 지출</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-red-700">{won.format(weeklyTotal)}원</p>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl bg-white px-4 shadow-sm">
        {days.map((date, index) => {
          const isToday = date === today;
          const spent = dailySpending.get(date) ?? 0;
          return (
            <Link
              key={date}
              href={`/daily?date=${date}&returnTo=${encodeURIComponent(`/weekly?start=${weekStart}`)}`}
              aria-label={`${weekdayLabels[index]}요일 ${shortDate(date)}${isToday ? " 오늘" : ""}, 지출 ${won.format(spent)}원`}
              className={`flex min-h-16 items-center justify-between gap-4 border-t border-stone-100 px-2 first:border-t-0 ${isToday ? "bg-stone-100 font-bold" : ""}`}
            >
              <span>
                <span>{weekdayLabels[index]}요일</span>
                <span className="ml-2 text-sm text-stone-500">{Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}</span>
                {isToday && <span className="ml-2 rounded-full bg-stone-900 px-2 py-1 text-xs font-bold text-white">오늘</span>}
              </span>
              <span className="font-semibold text-red-700">{won.format(spent)}원</span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
