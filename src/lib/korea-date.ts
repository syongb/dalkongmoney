const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export type KoreaMonth = {
  monthStart: string;
  nextMonthStart: string;
  monthLabel: string;
  daysRemaining: number;
  year: number;
  month: number;
  daysInMonth: number;
};

function buildKoreaMonth(year: number, month: number, currentDay: number): KoreaMonth {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const nextMonth = new Date(Date.UTC(year, month, 1));

  return {
    monthStart: `${year}-${twoDigits(month)}-01`,
    nextMonthStart: `${nextMonth.getUTCFullYear()}-${twoDigits(nextMonth.getUTCMonth() + 1)}-01`,
    monthLabel: `${month}월 생활비`,
    daysRemaining: Math.max(0, daysInMonth - currentDay + 1),
    year,
    month,
    daysInMonth,
  };
}

export function getCurrentKoreaMonth(now = new Date()): KoreaMonth {
  const koreaTime = new Date(now.getTime() + KOREA_OFFSET_MS);
  return buildKoreaMonth(
    koreaTime.getUTCFullYear(),
    koreaTime.getUTCMonth() + 1,
    koreaTime.getUTCDate(),
  );
}

export function getKoreaMonth(value: string | undefined, now = new Date()): KoreaMonth {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return getCurrentKoreaMonth(now);

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return getCurrentKoreaMonth(now);
  }

  const current = getCurrentKoreaMonth(now);
  const koreaTime = new Date(now.getTime() + KOREA_OFFSET_MS);
  const currentDay = current.year === year && current.month === month
    ? koreaTime.getUTCDate()
    : 1;
  return buildKoreaMonth(year, month, currentDay);
}

export function shiftKoreaMonth(monthStart: string, offset: number) {
  const year = Number(monthStart.slice(0, 4));
  const month = Number(monthStart.slice(5, 7));
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${twoDigits(shifted.getUTCMonth() + 1)}`;
}

export function isValidDateValue(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function shiftDateValue(value: string, offset: number) {
  const date = new Date(Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)) + offset,
  ));
  return `${date.getUTCFullYear()}-${twoDigits(date.getUTCMonth() + 1)}-${twoDigits(date.getUTCDate())}`;
}

export function formatKoreaDateLabel(value: string) {
  const date = new Date(Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  ));
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
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
