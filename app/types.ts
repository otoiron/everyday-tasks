export type Segment = {
  id: string;
  name: string;
};

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  parentChecked?: boolean;
  parentCheckedAt?: number;
  locked?: boolean;
  segmentId?: string;
  targetDate?: string; // YYYY-MM-DD（未指定なら当日扱い）
};

export type HistoryRecord = {
  id: string;
  title: string;
  completedAt: number;
  dateKey: string; // YYYY-MM-DD (ローカルタイム)
  parentChecked?: boolean;
  parentCheckedAt?: number;
};

export type TaskTemplate = {
  id: string;
  title: string;
  daysOfWeek: number[]; // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  locked?: boolean;
  segmentId?: string;
};

export type WeeklyAllowanceEntry = {
  amount: number;
  paid?: boolean;
  note?: string;
};

// キーは週の開始日（月曜日）の YYYY-MM-DD
export type WeeklyAllowances = Record<string, WeeklyAllowanceEntry>;
