import { supabase } from "./supabase";
import {
  Todo,
  HistoryRecord,
  TaskTemplate,
  WeeklyAllowances,
  WeeklyAllowanceEntry,
} from "../app/types";

// --- DB Row Types ---
type DbTodoRow = {
  id: string;
  title: string;
  completed: boolean;
  created_at: number;
  completed_at: number | null;
  parent_checked: boolean;
  parent_checked_at: number | null;
  locked: boolean;
  sort_order: number;
};

type DbHistoryRow = {
  id: string;
  title: string;
  completed_at: number;
  date_key: string;
  parent_checked: boolean;
  parent_checked_at: number | null;
};

type DbTemplateRow = {
  id: string;
  title: string;
  days_of_week: number[];
  locked: boolean;
  sort_order: number;
};

type DbAllowanceRow = {
  week_key: string;
  amount: number;
  paid: boolean;
  note: string;
};

type DbSettingRow = {
  key: string;
  value: string;
};

// --- Mappers ---
function mapDbTodo(row: DbTodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    createdAt: Number(row.created_at),
    completedAt: row.completed_at !== null ? Number(row.completed_at) : undefined,
    parentChecked: row.parent_checked,
    parentCheckedAt:
      row.parent_checked_at !== null ? Number(row.parent_checked_at) : undefined,
    locked: row.locked,
  };
}

function mapDbHistory(row: DbHistoryRow): HistoryRecord {
  return {
    id: row.id,
    title: row.title,
    completedAt: Number(row.completed_at),
    dateKey: row.date_key,
    parentChecked: row.parent_checked,
    parentCheckedAt:
      row.parent_checked_at !== null ? Number(row.parent_checked_at) : undefined,
  };
}

function mapDbTemplate(row: DbTemplateRow): TaskTemplate {
  return {
    id: row.id,
    title: row.title,
    daysOfWeek: Array.isArray(row.days_of_week) ? row.days_of_week : [],
    locked: row.locked,
  };
}

export type AppliedTemplatesState = {
  dateKey: string;
  templateIds: string[];
};

export type FetchedEtData = {
  todos: Todo[];
  history: HistoryRecord[];
  templates: TaskTemplate[];
  weeklyAllowances: WeeklyAllowances;
  adminPin: string;
  appliedTemplates: AppliedTemplatesState | null;
  migratedFromLocal: boolean;
};

/**
 * Supabase からすべてのアプリデータを取得する
 */
export async function fetchAllEtData(): Promise<FetchedEtData | null> {
  if (!supabase) return null;

  const [todosRes, historyRes, templatesRes, allowancesRes, settingsRes] =
    await Promise.all([
      supabase
        .from("et_todos")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("et_history")
        .select("*")
        .order("completed_at", { ascending: false }),
      supabase
        .from("et_templates")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase.from("et_weekly_allowances").select("*"),
      supabase.from("et_settings").select("*"),
    ]);

  if (
    todosRes.error ||
    historyRes.error ||
    templatesRes.error ||
    allowancesRes.error ||
    settingsRes.error
  ) {
    console.error("Supabase 読み込みエラー:", {
      todos: todosRes.error,
      history: historyRes.error,
      templates: templatesRes.error,
      allowances: allowancesRes.error,
      settings: settingsRes.error,
    });
    return null;
  }

  const todos = ((todosRes.data ?? []) as DbTodoRow[]).map(mapDbTodo);
  const history = ((historyRes.data ?? []) as DbHistoryRow[]).map(mapDbHistory);
  const templates = ((templatesRes.data ?? []) as DbTemplateRow[]).map(mapDbTemplate);

  const weeklyAllowances: WeeklyAllowances = {};
  for (const row of (allowancesRes.data ?? []) as DbAllowanceRow[]) {
    weeklyAllowances[row.week_key] = {
      amount: Number(row.amount ?? 0),
      paid: Boolean(row.paid),
      note: row.note ?? "",
    };
  }

  let adminPin = "1234";
  let appliedTemplates: AppliedTemplatesState | null = null;
  let migratedFromLocal = false;

  for (const row of (settingsRes.data ?? []) as DbSettingRow[]) {
    if (row.key === "admin_pin" && row.value) {
      adminPin = row.value;
    } else if (row.key === "applied_templates" && row.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed && typeof parsed.dateKey === "string" && Array.isArray(parsed.templateIds)) {
          appliedTemplates = parsed;
        }
      } catch {
        // ignore invalid json
      }
    } else if (row.key === "migrated_from_local" && row.value === "true") {
      migratedFromLocal = true;
    }
  }

  return {
    todos,
    history,
    templates,
    weeklyAllowances,
    adminPin,
    appliedTemplates,
    migratedFromLocal,
  };
}

// --- Todos ---
export async function upsertTodosList(todos: Todo[]): Promise<void> {
  if (!supabase || todos.length === 0) return;
  const rows: DbTodoRow[] = todos.map((t, index) => ({
    id: t.id,
    title: t.title,
    completed: t.completed,
    created_at: t.createdAt,
    completed_at: t.completedAt ?? null,
    parent_checked: Boolean(t.parentChecked),
    parent_checked_at: t.parentCheckedAt ?? null,
    locked: Boolean(t.locked),
    sort_order: index,
  }));

  const { error } = await supabase.from("et_todos").upsert(rows);
  if (error) console.error("et_todos upsert error:", error);
}

export async function updateTodoRow(
  id: string,
  patch: Partial<{
    title: string;
    completed: boolean;
    completed_at: number | null;
    parent_checked: boolean;
    parent_checked_at: number | null;
    locked: boolean;
  }>
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("et_todos").update(patch).eq("id", id);
  if (error) console.error("et_todos update error:", error);
}

export async function deleteTodoRows(ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return;
  const { error } = await supabase.from("et_todos").delete().in("id", ids);
  if (error) console.error("et_todos delete error:", error);
}

// --- History ---
export async function upsertHistoryRows(records: HistoryRecord[]): Promise<void> {
  if (!supabase || records.length === 0) return;
  const rows: DbHistoryRow[] = records.map((r) => ({
    id: r.id,
    title: r.title,
    completed_at: r.completedAt,
    date_key: r.dateKey,
    parent_checked: Boolean(r.parentChecked),
    parent_checked_at: r.parentCheckedAt ?? null,
  }));

  const { error } = await supabase.from("et_history").upsert(rows);
  if (error) console.error("et_history upsert error:", error);
}

export async function updateHistoryRow(
  id: string,
  patch: Partial<{
    title: string;
    parent_checked: boolean;
    parent_checked_at: number | null;
  }>
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("et_history").update(patch).eq("id", id);
  if (error) console.error("et_history update error:", error);
}

export async function deleteHistoryRow(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("et_history").delete().eq("id", id);
  if (error) console.error("et_history delete error:", error);
}

// --- Templates ---
export async function upsertTemplatesList(templates: TaskTemplate[]): Promise<void> {
  if (!supabase || templates.length === 0) return;
  const rows: DbTemplateRow[] = templates.map((tpl, index) => ({
    id: tpl.id,
    title: tpl.title,
    days_of_week: tpl.daysOfWeek,
    locked: Boolean(tpl.locked),
    sort_order: index,
  }));

  const { error } = await supabase.from("et_templates").upsert(rows);
  if (error) console.error("et_templates upsert error:", error);
}

export async function updateTemplateRow(
  id: string,
  patch: Partial<{ title: string; locked: boolean }>
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("et_templates").update(patch).eq("id", id);
  if (error) console.error("et_templates update error:", error);
}

export async function deleteTemplateRow(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("et_templates").delete().eq("id", id);
  if (error) console.error("et_templates delete error:", error);
}

// --- Weekly Allowances ---
export async function upsertWeeklyAllowanceRow(
  weekKey: string,
  entry: WeeklyAllowanceEntry
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("et_weekly_allowances").upsert({
    week_key: weekKey,
    amount: entry.amount,
    paid: Boolean(entry.paid),
    note: entry.note ?? "",
  });
  if (error) console.error("et_weekly_allowances upsert error:", error);
}

// --- Settings ---
export async function upsertSettingRow(key: string, value: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("et_settings").upsert({ key, value });
  if (error) console.error("et_settings upsert error:", error);
}
