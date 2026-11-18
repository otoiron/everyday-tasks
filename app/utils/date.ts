const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * ローカルタイムゾーンで YYYY-MM-DD 形式の日付キーを返す
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
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
 * weekOffset (0 = 今週, -1 = 先週, ...) に基づき、月曜〜日曜の7日間を返す
 */
export function getWeekDays(weekOffset: number): WeekDayInfo[] {
  const now = new Date();
  const todayKey = formatDateKey(now);

  // 月曜始まりにするための差分計算 (日曜=0 -> 6, 月曜=1 -> 0, ...)
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + diffToMonday + weekOffset * 7
  );

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateKey = formatDateKey(d);
    return {
      date: d,
      dateKey,
      monthDay: `${d.getMonth() + 1}/${d.getDate()}`,
      weekdayLabel: WEEKDAY_LABELS[d.getDay()],
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
 * 今日から daysOffset 日後の YYYY-MM-DD を返す
 */
export function getOffsetDateKey(daysOffset: number): string {
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysOffset
  );
  return formatDateKey(target);
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
  const date = new Date(year, month - 1, day);
  const weekday = WEEKDAY_LABELS[date.getDay()] ?? "";
  return `${month}/${day}（${weekday}）`;
}
