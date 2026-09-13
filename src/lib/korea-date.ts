const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export type KoreaMonth = {
  monthStart: string;
  nextMonthStart: string;
  monthLabel: string;
  daysRemaining: number;
};

export function getCurrentKoreaMonth(now = new Date()): KoreaMonth {
  const koreaTime = new Date(now.getTime() + KOREA_OFFSET_MS);
  const year = koreaTime.getUTCFullYear();
  const month = koreaTime.getUTCMonth() + 1;
  const day = koreaTime.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const nextMonth = new Date(Date.UTC(year, month, 1));

  return {
    monthStart: `${year}-${twoDigits(month)}-01`,
    nextMonthStart: `${nextMonth.getUTCFullYear()}-${twoDigits(nextMonth.getUTCMonth() + 1)}-01`,
    monthLabel: `${month}월 생활비`,
    daysRemaining: daysInMonth - day + 1,
  };
}

export function millisecondsUntilNextKoreaDay(now = new Date()) {
  const koreaTime = new Date(now.getTime() + KOREA_OFFSET_MS);
  const nextMidnight = Date.UTC(
    koreaTime.getUTCFullYear(),
    koreaTime.getUTCMonth(),
    koreaTime.getUTCDate() + 1,
  );

  return Math.max(1, nextMidnight - koreaTime.getTime());
}
