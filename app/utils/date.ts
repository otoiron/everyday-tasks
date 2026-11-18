const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getJstDateObject(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

/**
 * 日本時間（JST / UTC+9）固定で YYYY-MM-DD 形式の日付キーを返す
 */
export function formatDateKey(date: Date): string {
  const jst = getJstDateObject(date);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type WeekDayInfo = {
  date: Date;
  dateKey: string;
  monthDay: string; // 例: "11/17"
  weekdayLabel: string; // 例: "火"
  isToday: boolean;
};

/**
 * weekOffset (0 = 今週, -1 = 先週, ...) に基づき、日本時間基準で月曜〜日曜の7日間を返す
 */
export function getWeekDays(weekOffset: number): WeekDayInfo[] {
  const nowJst = getJstDateObject(new Date());
  const todayKey = formatDateKey(new Date());

  // 月曜始まりにするための差分計算 (日曜=0 -> -6, 月曜=1 -> 0, ...)
  const dayOfWeek = nowJst.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const baseUtcMs = Date.UTC(
    nowJst.getUTCFullYear(),
    nowJst.getUTCMonth(),
    nowJst.getUTCDate() + diffToMonday + weekOffset * 7
  );

  return Array.from({ length: 7 }, (_, i) => {
    const jstDay = new Date(baseUtcMs + i * 24 * 60 * 60 * 1000);
    const year = jstDay.getUTCFullYear();
    const month = jstDay.getUTCMonth() + 1;
    const day = jstDay.getUTCDate();
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      date: new Date(jstDay.getTime() - JST_OFFSET_MS),
      dateKey,
      monthDay: `${month}/${day}`,
      weekdayLabel: WEEKDAY_LABELS[jstDay.getUTCDay()],
      isToday: dateKey === todayKey,
    };
  });
}

/**
 * 週の範囲ラベルを返す (例: "11/16(月) 〜 11/22(日)")
 */
export function formatWeekRange(days: WeekDayInfo[]): string {
  if (days.length === 0) return "";
  const first = days[0];
  const last = days[days.length - 1];
  return `${first.monthDay}(${first.weekdayLabel}) 〜 ${last.monthDay}(${last.weekdayLabel})`;
}

/**
 * 週の一意キー（月曜日の YYYY-MM-DD）を返す
 */
export function getWeekKey(weekOffset: number): string {
  const days = getWeekDays(weekOffset);
  return days[0]?.dateKey ?? formatDateKey(new Date());
}

/**
 * 日本時間基準で今日から daysOffset 日後の YYYY-MM-DD を返す
 */
export function getOffsetDateKey(daysOffset: number): string {
  const nowJst = getJstDateObject(new Date());
  const target = new Date(
    Date.UTC(
      nowJst.getUTCFullYear(),
      nowJst.getUTCMonth(),
      nowJst.getUTCDate() + daysOffset
    )
  );
  const year = target.getUTCFullYear();
  const month = String(target.getUTCMonth() + 1).padStart(2, "0");
  const day = String(target.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * YYYY-MM-DD を "M/D（曜）" 形式に変換する
 */
export function formatDateWithWeekday(dateKey: string): string {
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return dateKey;
  }
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = WEEKDAY_LABELS[date.getUTCDay()] ?? "";
  return `${month}/${day}（${weekday}）`;
}
