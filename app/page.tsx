"use client";

import { useState, useEffect, useCallback, useRef, KeyboardEvent } from "react";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
  Badge,
} from "@chakra-ui/react";
import {
  Check,
  PencilSimple,
  Trash,
  ArrowCounterClockwise,
  X,
  DotsSixVertical,
  Lock,
} from "@phosphor-icons/react";
import {
  Todo,
  HistoryRecord,
  TaskTemplate,
  WeeklyAllowances,
  WeeklyAllowanceEntry,
} from "./types";
import { formatDateKey, getWeekKey } from "./utils/date";
import { reorderList, useDragReorder } from "./hooks/useDragReorder";
import { HistoryView } from "./components/HistoryView";
import { AdminView } from "./components/AdminView";
import {
  fetchAllEtData,
  upsertTodosList,
  updateTodoRow,
  deleteTodoRows,
  upsertHistoryRows,
  updateHistoryRow,
  deleteHistoryRow,
  upsertTemplatesList,
  updateTemplateRow,
  deleteTemplateRow,
  upsertWeeklyAllowanceRow,
  upsertSettingRow,
  AppliedTemplatesState,
} from "../lib/etDb";

const STORAGE_KEY = "kids-todo-app-tasks-v1";
const HISTORY_STORAGE_KEY = "kids-todo-app-history-v1";
const ADMIN_PIN_STORAGE_KEY = "kids-todo-app-admin-pin-v1";
const TEMPLATES_STORAGE_KEY = "kids-todo-app-templates-v1";
const APPLIED_TEMPLATES_STORAGE_KEY = "kids-todo-app-applied-templates-v1";
const ALLOWANCES_STORAGE_KEY = "kids-todo-app-allowances-v1";
const DEFAULT_ADMIN_PIN = "1234";

type ActiveTab = "tasks" | "history" | "admin";

type DeleteConfirmTarget =
  | { type: "single"; todo: Todo }
  | { type: "clearCompleted" }
  | null;

function readLocalBackup() {
  const savedTodos = localStorage.getItem(STORAGE_KEY);
  const parsedTodos: Todo[] =
    savedTodos && Array.isArray(JSON.parse(savedTodos)) ? JSON.parse(savedTodos) : [];

  const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
  const parsedHistory: HistoryRecord[] =
    savedHistory && Array.isArray(JSON.parse(savedHistory))
      ? JSON.parse(savedHistory)
      : [];

  const savedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
  const parsedTemplates: TaskTemplate[] =
    savedTemplates && Array.isArray(JSON.parse(savedTemplates))
      ? JSON.parse(savedTemplates)
      : [];

  const savedPin = localStorage.getItem(ADMIN_PIN_STORAGE_KEY);
  const parsedPin = savedPin && savedPin.trim().length > 0 ? savedPin : DEFAULT_ADMIN_PIN;

  const savedAllowances = localStorage.getItem(ALLOWANCES_STORAGE_KEY);
  const rawAllowances =
    savedAllowances && typeof JSON.parse(savedAllowances) === "object"
      ? JSON.parse(savedAllowances)
      : {};
  const parsedAllowances: WeeklyAllowances = {};
  for (const [key, val] of Object.entries(rawAllowances)) {
    if (typeof val === "number") {
      parsedAllowances[key] = { amount: val, paid: false, note: "" };
    } else if (val && typeof val === "object") {
      const entry = val as Partial<WeeklyAllowanceEntry>;
      parsedAllowances[key] = {
        amount: typeof entry.amount === "number" ? entry.amount : 0,
        paid: Boolean(entry.paid),
        note: typeof entry.note === "string" ? entry.note : "",
      };
    }
  }

  let parsedApplied: AppliedTemplatesState | null = null;
  const savedApplied = localStorage.getItem(APPLIED_TEMPLATES_STORAGE_KEY);
  if (savedApplied) {
    const parsed = JSON.parse(savedApplied);
    if (parsed && typeof parsed.dateKey === "string" && Array.isArray(parsed.templateIds)) {
      parsedApplied = parsed;
    }
  }

  return {
    todos: parsedTodos,
    history: parsedHistory,
    templates: parsedTemplates,
    weeklyAllowances: parsedAllowances,
    adminPin: parsedPin,
    appliedTemplates: parsedApplied,
  };
}

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [weeklyAllowances, setWeeklyAllowances] = useState<WeeklyAllowances>({});
  const [adminPin, setAdminPin] = useState<string>(DEFAULT_ADMIN_PIN);
  const [appliedTemplates, setAppliedTemplates] = useState<AppliedTemplatesState | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("tasks");
  const [deleteTarget, setDeleteTarget] = useState<DeleteConfirmTarget>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState("");
  const [completingIds, setCompletingIds] = useState<string[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const isSyncingRef = useRef(false);

  const loadFromSupabase = useCallback(async (isInitial: boolean) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const dbData = await fetchAllEtData();
      if (!dbData) {
        if (isInitial) {
          const local = readLocalBackup();
          setTodos(local.todos);
          setHistory(local.history);
          setTemplates(local.templates);
          setWeeklyAllowances(local.weeklyAllowances);
          setAdminPin(local.adminPin);
          setAppliedTemplates(local.appliedTemplates);
        }
        return;
      }

      let currentTodos = dbData.todos;
      let currentHistory = dbData.history;
      let currentTemplates = dbData.templates;
      let currentAllowances = dbData.weeklyAllowances;
      let currentPin = dbData.adminPin;
      let currentApplied = dbData.appliedTemplates;

      // 初回接続時：DBが空でローカルにデータがあれば自動移行
      if (
        isInitial &&
        !dbData.migratedFromLocal &&
        currentTodos.length === 0 &&
        currentHistory.length === 0 &&
        currentTemplates.length === 0 &&
        Object.keys(currentAllowances).length === 0
      ) {
        const local = readLocalBackup();
        const hasLocalData =
          local.todos.length > 0 ||
          local.history.length > 0 ||
          local.templates.length > 0 ||
          Object.keys(local.weeklyAllowances).length > 0;

        if (hasLocalData) {
          currentTodos = local.todos;
          currentHistory = local.history;
          currentTemplates = local.templates;
          currentAllowances = local.weeklyAllowances;
          currentPin = local.adminPin;
          currentApplied = local.appliedTemplates;

          await Promise.all([
            upsertTodosList(currentTodos),
            upsertHistoryRows(currentHistory),
            upsertTemplatesList(currentTemplates),
            ...Object.entries(currentAllowances).map(([wk, entry]) =>
              upsertWeeklyAllowanceRow(wk, entry)
            ),
            upsertSettingRow("admin_pin", currentPin),
            currentApplied
              ? upsertSettingRow("applied_templates", JSON.stringify(currentApplied))
              : Promise.resolve(),
            upsertSettingRow("migrated_from_local", "true"),
          ]);
        } else {
          await upsertSettingRow("migrated_from_local", "true");
        }
      }

      // 既存の完了済みタスクで履歴に未登録のものがあれば補完
      const historyIds = new Set(currentHistory.map((h) => h.id));
      const missingCompleted = currentTodos.filter(
        (t) => t.completed && !historyIds.has(t.id)
      );
      if (missingCompleted.length > 0) {
        const migratedRecords: HistoryRecord[] = missingCompleted.map((t) => {
          const ts = t.completedAt ?? t.createdAt;
          return {
            id: t.id,
            title: t.title,
            completedAt: ts,
            dateKey: formatDateKey(new Date(ts)),
            parentChecked: t.parentChecked,
            parentCheckedAt: t.parentCheckedAt,
          };
        });
        currentHistory = [...migratedRecords, ...currentHistory];
        await upsertHistoryRows(migratedRecords);
      }

      // 日付が変わっていたら、前日以前に完了済みのタスクを「できた！リスト」から自動整理（履歴は保持）
      const now = new Date();
      const todayKey = formatDateKey(now);

      const outdatedCompletedIds: string[] = [];
      currentTodos = currentTodos.filter((t) => {
        if (!t.completed) return true;
        const completedDateKey = formatDateKey(new Date(t.completedAt ?? t.createdAt));
        if (completedDateKey !== todayKey) {
          outdatedCompletedIds.push(t.id);
          return false;
        }
        return true;
      });
      if (outdatedCompletedIds.length > 0) {
        await deleteTodoRows(outdatedCompletedIds);
      }

      setTodos(currentTodos);
      setHistory(currentHistory);
      setTemplates(currentTemplates);
      setWeeklyAllowances(currentAllowances);
      setAdminPin(currentPin);
      setAppliedTemplates(currentApplied);
    } catch (error) {
      console.error("データの読み込みに失敗しました:", error);
    } finally {
      isSyncingRef.current = false;
      if (isInitial) setIsMounted(true);
    }
  }, []);

  // 初回マウント時に Supabase からデータ復元
  useEffect(() => {
    void loadFromSupabase(true);
  }, [loadFromSupabase]);

  // タブレットや別端末からの復帰時に最新状態へ同期
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void loadFromSupabase(false);
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [loadFromSupabase]);

  // 週ごとのお小遣い（金額・支払い済み・ひと言メモ）を更新
  const handleUpdateWeeklyAllowance = (
    weekKey: string,
    update: Partial<WeeklyAllowanceEntry>
  ) => {
    const existing = weeklyAllowances[weekKey] ?? { amount: 0, paid: false, note: "" };
    const nextEntry: WeeklyAllowanceEntry = {
      ...existing,
      ...update,
      amount:
        update.amount !== undefined ? Math.max(0, update.amount) : existing.amount,
    };

    setWeeklyAllowances((prev) => ({
      ...prev,
      [weekKey]: nextEntry,
    }));
    void upsertWeeklyAllowanceRow(weekKey, nextEntry);
  };

  // 管理者パスワード変更
  const handleChangePin = (newPin: string) => {
    setAdminPin(newPin);
    void upsertSettingRow("admin_pin", newPin);
  };

  // タスクの追加
  const handleAddTodo = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const newTodo: Todo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: trimmed,
      completed: false,
      createdAt: Date.now(),
    };

    const nextTodos = [newTodo, ...todos];
    setTodos(nextTodos);
    setInputValue("");
    void upsertTodosList(nextTodos);
  };

  // Enterキーでの追加（日本語変換中のEnterは無視）
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      handleAddTodo();
    }
  };

  // フェードアウト＋スライド詰まりアニメーション付きで完了/未完了を切り替える
  const handleToggleWithFade = (id: string) => {
    if (completingIds.includes(id)) return;
    const target = todos.find((t) => t.id === id);
    if (!target) return;

    const nextCompleted = !target.completed;
    setCompletingIds((prev) => [...prev, id]);

    setTimeout(() => {
      const now = Date.now();
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id
            ? {
                ...todo,
                completed: nextCompleted,
                completedAt: nextCompleted ? now : undefined,
                parentChecked: false,
                parentCheckedAt: undefined,
              }
            : todo
        )
      );

      void updateTodoRow(id, {
        completed: nextCompleted,
        completed_at: nextCompleted ? now : null,
        parent_checked: false,
        parent_checked_at: null,
      });

      if (nextCompleted) {
        const newRecord: HistoryRecord = {
          id: target.id,
          title: target.title,
          completedAt: now,
          dateKey: formatDateKey(new Date(now)),
          parentChecked: false,
        };
        setHistory((prev) => [newRecord, ...prev.filter((h) => h.id !== target.id)]);
        void upsertHistoryRows([newRecord]);
      } else {
        setHistory((prev) => prev.filter((h) => h.id !== target.id));
        void deleteHistoryRow(target.id);
      }

      setCompletingIds((prev) => prev.filter((item) => item !== id));
    }, 580);
  };

  // タスクの削除（達成履歴は残す）
  const handleDeleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
    void deleteTodoRows([id]);
  };

  // 完了済みタスクをリストから削除（ロックされたタスクと達成履歴は残す）
  const handleClearCompleted = () => {
    const idsToDelete = todos
      .filter((todo) => todo.completed && !todo.locked)
      .map((todo) => todo.id);
    setTodos((prev) => prev.filter((todo) => !todo.completed || todo.locked));
    void deleteTodoRows(idsToDelete);
  };

  // ダイアログで「けす」を確定したときの処理
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "single") {
      handleDeleteTodo(deleteTarget.todo.id);
    } else {
      handleClearCompleted();
    }
    setDeleteTarget(null);
  };

  // 親（管理者）による確認OK
  const handleApproveTask = (id: string) => {
    const now = Date.now();
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id
          ? { ...todo, parentChecked: true, parentCheckedAt: now }
          : todo
      )
    );
    setHistory((prev) =>
      prev.map((record) =>
        record.id === id
          ? { ...record, parentChecked: true, parentCheckedAt: now }
          : record
      )
    );
    void updateTodoRow(id, { parent_checked: true, parent_checked_at: now });
    void updateHistoryRow(id, { parent_checked: true, parent_checked_at: now });
  };

  // 親（管理者）による確認取り消し
  const handleUnapproveTask = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id
          ? { ...todo, parentChecked: false, parentCheckedAt: undefined }
          : todo
      )
    );
    setHistory((prev) =>
      prev.map((record) =>
        record.id === id
          ? { ...record, parentChecked: false, parentCheckedAt: undefined }
          : record
      )
    );
    void updateTodoRow(id, { parent_checked: false, parent_checked_at: null });
    void updateHistoryRow(id, { parent_checked: false, parent_checked_at: null });
  };

  // 親（管理者）による差し戻し（これからやることへ戻し、履歴からも削除）
  const handleRejectToActive = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              completed: false,
              completedAt: undefined,
              parentChecked: false,
              parentCheckedAt: undefined,
            }
          : todo
      )
    );
    setHistory((prev) => prev.filter((record) => record.id !== id));
    void updateTodoRow(id, {
      completed: false,
      completed_at: null,
      parent_checked: false,
      parent_checked_at: null,
    });
    void deleteHistoryRow(id);
  };

  // テンプレートの追加
  const handleAddTemplate = (
    title: string,
    daysOfWeek: number[],
    locked: boolean
  ) => {
    const newTemplate: TaskTemplate = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      daysOfWeek,
      locked,
    };
    const nextTemplates = [...templates, newTemplate];
    setTemplates(nextTemplates);
    void upsertTemplatesList(nextTemplates);
  };

  // テンプレートのロック状態切り替え
  const handleToggleTemplateLock = (id: string) => {
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    const nextLocked = !target.locked;
    setTemplates((prev) =>
      prev.map((tpl) => (tpl.id === id ? { ...tpl, locked: nextLocked } : tpl))
    );
    void updateTemplateRow(id, { locked: nextLocked });
  };

  // タスク名の編集開始
  const handleStartEditTodo = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditingTodoTitle(todo.title);
  };

  // タスク名の編集保存
  const handleSaveEditTodo = () => {
    if (!editingTodoId) return;
    const trimmed = editingTodoTitle.trim();
    if (!trimmed) return;

    const targetId = editingTodoId;
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === targetId ? { ...todo, title: trimmed } : todo
      )
    );
    setHistory((prev) =>
      prev.map((record) =>
        record.id === targetId ? { ...record, title: trimmed } : record
      )
    );
    void updateTodoRow(targetId, { title: trimmed });
    void updateHistoryRow(targetId, { title: trimmed });

    setEditingTodoId(null);
    setEditingTodoTitle("");
  };

  // タスク名の編集キャンセル
  const handleCancelEditTodo = () => {
    setEditingTodoId(null);
    setEditingTodoTitle("");
  };

  // テンプレートの削除
  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
    void deleteTemplateRow(id);
  };

  // テンプレート名の編集
  const handleEditTemplate = (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setTemplates((prev) =>
      prev.map((tpl) => (tpl.id === id ? { ...tpl, title: trimmed } : tpl))
    );
    void updateTemplateRow(id, { title: trimmed });
  };

  // テンプレートの並び替え
  const handleReorderTemplates = (fromIndex: number, toIndex: number) => {
    const nextTemplates = reorderList(templates, fromIndex, toIndex);
    setTemplates(nextTemplates);
    void upsertTemplatesList(nextTemplates);
  };

  // 「これから やること」の並び替え
  const handleReorderActiveTodos = (fromIndex: number, toIndex: number) => {
    const currentActive = todos.filter((t) => !t.completed);
    const currentCompleted = todos.filter((t) => t.completed);
    const reorderedActive = reorderList(currentActive, fromIndex, toIndex);
    const nextTodos = [...reorderedActive, ...currentCompleted];
    setTodos(nextTodos);
    void upsertTodosList(nextTodos);
  };

  const {
    containerRef: activeListRef,
    draggingIndex: draggingTodoIndex,
    startDrag: startTodoDrag,
    getItemStyle: getTodoItemStyle,
  } = useDragReorder(handleReorderActiveTodos);

  // テンプレートから1件タスクを手動追加
  const handleAddTodoFromTemplate = (tpl: TaskTemplate) => {
    const newTodo: Todo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: tpl.title,
      completed: false,
      createdAt: Date.now(),
      locked: Boolean(tpl.locked),
    };
    const nextTodos = [newTodo, ...todos];
    setTodos(nextTodos);
    void upsertTodosList(nextTodos);
  };

  // 今日の曜日に一致するテンプレートを手動でまとめて追加（すでにリストにあるタイトルはスキップ）
  const handleApplyTodayTemplates = (): number => {
    const todayDay = new Date().getDay();
    const existingTitles = new Set(todos.map((t) => t.title));

    const templatesToApply = templates.filter(
      (tpl) => tpl.daysOfWeek.includes(todayDay) && !existingTitles.has(tpl.title)
    );

    if (templatesToApply.length === 0) {
      return 0;
    }

    const newTodos: Todo[] = templatesToApply.map((tpl, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      title: tpl.title,
      completed: false,
      createdAt: Date.now(),
      locked: Boolean(tpl.locked),
    }));

    const nextTodos = [...newTodos, ...todos];
    setTodos(nextTodos);
    void upsertTodosList(nextTodos);

    return templatesToApply.length;
  };

  const activeTodos = todos.filter((todo) => !todo.completed);
  const completedTodos = todos.filter((todo) => todo.completed);
  const currentWeekEntry = isMounted ? weeklyAllowances[getWeekKey(0)] : undefined;
  const currentWeekAllowance = currentWeekEntry?.amount ?? 0;
  const currentWeekAllowancePaid = Boolean(currentWeekEntry?.paid);

  return (
    <Box minH="100vh" bg="#EEF6FF" py={{ base: 6, md: 10 }} px={{ base: 4, md: 6 }}>
      <Container maxW="640px" p={0}>
        <VStack gap={6} align="stretch">
          {/* ヘッダー */}
          <Box
            bg="white"
            p={{ base: 5, md: 6 }}
            borderRadius="2xl"
            borderWidth="2px"
            borderColor="#CFE2FF"
            boxShadow="0 4px 14px rgba(144, 205, 244, 0.2)"
            textAlign="center"
            position="relative"
          >
            <Flex justify="flex-end" mb={{ base: 2, md: 0 }}>
              <Button
                onClick={() => setActiveTab(activeTab === "admin" ? "tasks" : "admin")}
                size="xs"
                h="30px"
                px={3}
                borderRadius="full"
                bg={activeTab === "admin" ? "#2D3748" : "#EDF2F7"}
                color={activeTab === "admin" ? "white" : "#4A5568"}
                _hover={{
                  bg: activeTab === "admin" ? "#1A202C" : "#E2E8F0",
                }}
                fontWeight="bold"
              >
                {activeTab === "admin" ? "子ども画面へ" : "おうちの人用"}
              </Button>
            </Flex>

            <Heading
              as="h1"
              fontSize={{ base: "2xl", md: "3xl" }}
              color="#2B6CB0"
              fontWeight="bold"
              mb={3}
            >
              今日のやることリスト
            </Heading>
            <HStack justify="center" gap={3} flexWrap="wrap">
              <Badge
                px={3}
                py={1}
                borderRadius="full"
                bg="#EBF8FF"
                color="#2B6CB0"
                fontSize="sm"
                fontWeight="bold"
              >
                やること: {isMounted ? activeTodos.length : 0}個
              </Badge>
              <Badge
                px={3}
                py={1}
                borderRadius="full"
                bg="#FFF3E0"
                color="#C05621"
                fontSize="sm"
                fontWeight="bold"
              >
                できた！: {isMounted ? completedTodos.length : 0}個
              </Badge>
              <Badge
                px={3}
                py={1}
                borderRadius="full"
                bg="#F0FFF4"
                color="#2F855A"
                fontSize="sm"
                fontWeight="bold"
              >
                今週のおこづかい: {currentWeekAllowance.toLocaleString()}円
                {currentWeekAllowancePaid ? "（わたしたよ！）" : ""}
              </Badge>
            </HStack>
          </Box>

          {/* 画面切り替えタブ（管理者画面以外のときに表示） */}
          {activeTab !== "admin" && (
            <HStack gap={3}>
              <Button
                onClick={() => setActiveTab("tasks")}
                flex={1}
                h="52px"
                fontSize={{ base: "md", md: "lg" }}
                fontWeight="bold"
                borderRadius="xl"
                borderWidth="2px"
                borderColor={activeTab === "tasks" ? "#4299E1" : "#CFE2FF"}
                bg={activeTab === "tasks" ? "#63B3ED" : "white"}
                color={activeTab === "tasks" ? "white" : "#2B6CB0"}
                _hover={{
                  bg: activeTab === "tasks" ? "#4299E1" : "#EBF8FF",
                }}
              >
                今日のやること
              </Button>
              <Button
                onClick={() => setActiveTab("history")}
                flex={1}
                h="52px"
                fontSize={{ base: "md", md: "lg" }}
                fontWeight="bold"
                borderRadius="xl"
                borderWidth="2px"
                borderColor={activeTab === "history" ? "#ED8936" : "#CFE2FF"}
                bg={activeTab === "history" ? "#F6AD55" : "white"}
                color={activeTab === "history" ? "white" : "#C05621"}
                _hover={{
                  bg: activeTab === "history" ? "#ED8936" : "#FFF8F0",
                }}
              >
                これまでの記録
              </Button>
            </HStack>
          )}

          {activeTab === "admin" ? (
            <AdminView
              todos={todos}
              history={history}
              templates={templates}
              weeklyAllowances={weeklyAllowances}
              adminPin={adminPin}
              onChangePin={handleChangePin}
              onApproveTask={handleApproveTask}
              onUnapproveTask={handleUnapproveTask}
              onRejectToActive={handleRejectToActive}
              onAddTemplate={handleAddTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onEditTemplate={handleEditTemplate}
              onToggleTemplateLock={handleToggleTemplateLock}
              onReorderTemplates={handleReorderTemplates}
              onApplyTodayTemplates={handleApplyTodayTemplates}
              onUpdateWeeklyAllowance={handleUpdateWeeklyAllowance}
              onExit={() => setActiveTab("tasks")}
            />
          ) : activeTab === "history" ? (
            isMounted ? (
              <HistoryView history={history} weeklyAllowances={weeklyAllowances} />
            ) : (
              <Box
                bg="white"
                p={8}
                borderRadius="2xl"
                borderWidth="2px"
                borderColor="#CFE2FF"
                textAlign="center"
              >
                <Text color="#718096">読み込み中...</Text>
              </Box>
            )
          ) : (
            <>
              {/* タスク追加フォーム */}
              <Box
                bg="white"
                p={{ base: 4, md: 5 }}
                borderRadius="2xl"
                borderWidth="2px"
                borderColor="#CFE2FF"
                boxShadow="0 4px 12px rgba(144, 205, 244, 0.15)"
              >
                <Flex
                  direction={{ base: "column", sm: "row" }}
                  gap={3}
                  align={{ base: "stretch", sm: "center" }}
                >
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="やることを書いてね（例：宿題）"
                    size="lg"
                    h="56px"
                    fontSize={{ base: "md", md: "lg" }}
                    bg="#F8FAFC"
                    color="#2D3748"
                    borderWidth="2px"
                    borderColor="#CBD5E0"
                    borderRadius="xl"
                    _focus={{
                      borderColor: "#63B3ED",
                      bg: "white",
                      outline: "none",
                    }}
                  />
                  <Button
                    onClick={handleAddTodo}
                    disabled={!inputValue.trim()}
                    h="56px"
                    px={8}
                    fontSize="lg"
                    fontWeight="bold"
                    borderRadius="xl"
                    bg="#63B3ED"
                    color="white"
                    _hover={{ bg: "#4299E1" }}
                    _active={{ bg: "#3182CE" }}
                    _disabled={{
                      bg: "#CBD5E0",
                      color: "#718096",
                      cursor: "not-allowed",
                    }}
                    flexShrink={0}
                  >
                    追加！
                  </Button>
                </Flex>

                {isMounted && templates.length > 0 && (
                  <Box mt={3} pt={3} borderTopWidth="1px" borderColor="#EDF2F7">
                    <Flex justify="space-between" align="center" gap={2} flexWrap="wrap">
                      <Button
                        onClick={() => setShowTemplatePicker((prev) => !prev)}
                        size="sm"
                        h="38px"
                        px={4}
                        borderRadius="xl"
                        bg={showTemplatePicker ? "#4299E1" : "#EBF8FF"}
                        color={showTemplatePicker ? "white" : "#2B6CB0"}
                        fontWeight="bold"
                        _hover={{
                          bg: showTemplatePicker ? "#3182CE" : "#BEE3F8",
                        }}
                      >
                        {showTemplatePicker
                          ? "テンプレートをとじる"
                          : `テンプレートから追加（${templates.length}個）`}
                      </Button>

                      <Button
                        onClick={() => {
                          handleApplyTodayTemplates();
                        }}
                        size="sm"
                        h="38px"
                        px={4}
                        borderRadius="xl"
                        bg="#FFF3E0"
                        color="#C05621"
                        fontWeight="bold"
                        borderWidth="1px"
                        borderColor="#FBD38D"
                        _hover={{ bg: "#FEEBC8" }}
                      >
                        今日の分をまとめて追加
                      </Button>
                    </Flex>

                    {showTemplatePicker && (
                      <Flex mt={3} gap={2} flexWrap="wrap">
                        {templates.map((tpl) => {
                          const alreadyAdded = todos.some((t) => t.title === tpl.title);
                          return (
                            <Button
                              key={tpl.id}
                              onClick={() => handleAddTodoFromTemplate(tpl)}
                              h="40px"
                              px={3.5}
                              fontSize="sm"
                              fontWeight="bold"
                              borderRadius="xl"
                              borderWidth="1px"
                              borderColor={alreadyAdded ? "#CBD5E0" : "#BEE3F8"}
                              bg={alreadyAdded ? "#F7FAFC" : "#F8FBFF"}
                              color={alreadyAdded ? "#718096" : "#2B6CB0"}
                              _hover={{ bg: "#EBF8FF" }}
                            >
                              + {tpl.title}
                              {alreadyAdded ? "（追加ずみ）" : ""}
                            </Button>
                          );
                        })}
                      </Flex>
                    )}
                  </Box>
                )}
              </Box>

              {/* やることリスト */}
              <Box
                bg="white"
                p={{ base: 4, md: 6 }}
                borderRadius="2xl"
                borderWidth="2px"
                borderColor="#CFE2FF"
                boxShadow="0 4px 12px rgba(144, 205, 244, 0.15)"
              >
                <Heading as="h2" fontSize="xl" color="#2D3748" mb={4}>
                  これからやること
                </Heading>

                {!isMounted ? (
                  <Box
                    bg="#F7FAFC"
                    borderRadius="xl"
                    p={6}
                    textAlign="center"
                    borderWidth="2px"
                    borderStyle="dashed"
                    borderColor="#E2E8F0"
                  >
                    <Text fontSize="md" color="#718096">
                      読み込み中...
                    </Text>
                  </Box>
                ) : activeTodos.length === 0 ? (
                  <Box
                    bg="#F7FAFC"
                    borderRadius="xl"
                    p={6}
                    textAlign="center"
                    borderWidth="2px"
                    borderStyle="dashed"
                    borderColor="#CBD5E0"
                  >
                    <Text fontSize="lg" color="#4A5568" fontWeight="medium">
                      {completedTodos.length > 0
                        ? "全部終わったよ！すごいね！"
                        : "やることを追加してみよう！"}
                    </Text>
                  </Box>
                ) : (
                  <VStack ref={activeListRef} gap={0} align="stretch">
                    {activeTodos.map((todo, index) => {
                      const isDragging = draggingTodoIndex === index;
                      const isEditing = editingTodoId === todo.id;
                      const isCompleting = completingIds.includes(todo.id);
                      const isLast = index === activeTodos.length - 1;
                      const dragStyle = getTodoItemStyle(index);
                      return (
                        <Box
                          key={todo.id}
                          style={{
                            ...dragStyle,
                            display: "grid",
                            gridTemplateRows: isCompleting ? "0fr" : "1fr",
                            opacity: isCompleting ? 0 : 1,
                            paddingBottom: isCompleting || isLast ? "0px" : "12px",
                            transition: isDragging
                              ? "none"
                              : "opacity 0.28s ease, grid-template-rows 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.28s, padding-bottom 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.28s",
                          }}
                        >
                          <Box overflow="hidden">
                            <Flex
                              align="center"
                              justify="space-between"
                              gap={2.5}
                              p={{ base: 3, md: 4 }}
                              bg={isDragging ? "#FFFBF5" : "#F8FBFF"}
                              borderRadius="xl"
                              borderWidth="2px"
                              borderColor={
                                isEditing
                                  ? "#4299E1"
                                  : isDragging
                                  ? "#F6AD55"
                                  : "#BEE3F8"
                              }
                              boxShadow={
                                isDragging
                                  ? "0 12px 28px rgba(43, 108, 176, 0.25)"
                                  : "none"
                              }
                            >
                              {isEditing ? (
                                <>
                                  <Input
                                    value={editingTodoTitle}
                                    onChange={(e) => setEditingTodoTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                        handleSaveEditTodo();
                                      } else if (e.key === "Escape") {
                                        handleCancelEditTodo();
                                      }
                                    }}
                                    autoFocus
                                    h="44px"
                                    fontSize={{ base: "md", md: "lg" }}
                                    fontWeight="bold"
                                    bg="white"
                                    color="#2D3748"
                                    borderWidth="2px"
                                    borderColor="#63B3ED"
                                    borderRadius="xl"
                                    flex={1}
                                  />
                                  <HStack gap={1.5} flexShrink={0}>
                                    <Button
                                      onClick={handleSaveEditTodo}
                                      disabled={!editingTodoTitle.trim()}
                                      w="44px"
                                      h="44px"
                                      p={0}
                                      borderRadius="xl"
                                      bg="#4299E1"
                                      color="white"
                                      _hover={{ bg: "#3182CE" }}
                                      aria-label="ほぞんする"
                                      title="ほぞん"
                                    >
                                      <Check size={22} weight="bold" />
                                    </Button>
                                    <Button
                                      onClick={handleCancelEditTodo}
                                      w="44px"
                                      h="44px"
                                      p={0}
                                      borderRadius="xl"
                                      bg="#EDF2F7"
                                      color="#4A5568"
                                      _hover={{ bg: "#E2E8F0" }}
                                      aria-label="やめる"
                                      title="やめる"
                                    >
                                      <X size={20} weight="bold" />
                                    </Button>
                                  </HStack>
                                </>
                              ) : (
                                <>
                                  <Flex
                                    onPointerDown={(e) => startTodoDrag(index, e)}
                                    style={{ touchAction: "none" }}
                                    cursor={isDragging ? "grabbing" : "grab"}
                                    w="32px"
                                    h="44px"
                                    align="center"
                                    justify="center"
                                    borderRadius="lg"
                                    bg="#EBF8FF"
                                    color="#4299E1"
                                    userSelect="none"
                                    flexShrink={0}
                                    title="ドラッグして じゅんばんを かえる"
                                  >
                                    <DotsSixVertical size={20} weight="bold" />
                                  </Flex>

                                  <Text
                                    fontSize={{ base: "md", md: "lg" }}
                                    fontWeight="bold"
                                    color="#2D3748"
                                    wordBreak="break-word"
                                    flex={1}
                                  >
                                    {todo.title}
                                  </Text>

                                  <HStack gap={1.5} flexShrink={0}>
                                    <Button
                                      onClick={() => handleToggleWithFade(todo.id)}
                                      w="44px"
                                      h="44px"
                                      p={0}
                                      borderRadius="xl"
                                      bg="#F6AD55"
                                      color="white"
                                      _hover={{ bg: "#ED8936" }}
                                      _active={{ bg: "#DD6B20" }}
                                      aria-label={`${todo.title} をできたにする`}
                                      title="できた！"
                                    >
                                      <Check size={22} weight="bold" />
                                    </Button>
                                    {todo.locked ? (
                                      <Flex
                                        w="36px"
                                        h="44px"
                                        align="center"
                                        justify="center"
                                        color="#A0AEC0"
                                        title="おうちの人がきめた タスクだよ"
                                      >
                                        <Lock size={18} weight="bold" />
                                      </Flex>
                                    ) : (
                                      <>
                                        <Button
                                          onClick={() => handleStartEditTodo(todo)}
                                          w="44px"
                                          h="44px"
                                          p={0}
                                          borderRadius="xl"
                                          bg="#EBF8FF"
                                          color="#2B6CB0"
                                          _hover={{ bg: "#BEE3F8" }}
                                          aria-label={`${todo.title} をなおす`}
                                          title="なおす"
                                        >
                                          <PencilSimple size={20} weight="bold" />
                                        </Button>
                                        <Button
                                          onClick={() => setDeleteTarget({ type: "single", todo })}
                                          w="44px"
                                          h="44px"
                                          p={0}
                                          borderRadius="xl"
                                          bg="#EDF2F7"
                                          color="#4A5568"
                                          _hover={{ bg: "#FED7D7", color: "#9B2C2C" }}
                                          aria-label={`${todo.title} をけす`}
                                          title="けす"
                                        >
                                          <Trash size={20} weight="bold" />
                                        </Button>
                                      </>
                                    )}
                                  </HStack>
                                </>
                              )}
                            </Flex>
                          </Box>
                        </Box>
                      );
                    })}
                  </VStack>
                )}
              </Box>

              {/* できた！リスト */}
              {isMounted && completedTodos.length > 0 && (
                <Box
                  bg="#F7FAFC"
                  p={{ base: 4, md: 6 }}
                  borderRadius="2xl"
                  borderWidth="2px"
                  borderColor="#E2E8F0"
                >
                  <Flex justify="space-between" align="center" mb={4} gap={2} flexWrap="wrap">
                    <Heading as="h2" fontSize="xl" color="#C05621">
                      できた！リスト
                    </Heading>
                    {completedTodos.some((t) => !t.locked) && (
                      <Button
                        onClick={() => setDeleteTarget({ type: "clearCompleted" })}
                        size="sm"
                        h="36px"
                        px={3}
                        borderRadius="lg"
                        bg="#EDF2F7"
                        color="#4A5568"
                        _hover={{ bg: "#E2E8F0" }}
                      >
                        できたのを全部消す
                      </Button>
                    )}
                  </Flex>

                  <VStack gap={0} align="stretch">
                    {completedTodos.map((todo, index) => {
                      const isFading = completingIds.includes(todo.id);
                      const isLast = index === completedTodos.length - 1;
                      return (
                        <Box
                          key={todo.id}
                          style={{
                            display: "grid",
                            gridTemplateRows: isFading ? "0fr" : "1fr",
                            opacity: isFading ? 0 : 1,
                            paddingBottom: isFading || isLast ? "0px" : "12px",
                            transition:
                              "opacity 0.28s ease, grid-template-rows 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.28s, padding-bottom 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.28s",
                          }}
                        >
                          <Box overflow="hidden">
                            <Flex
                              align="center"
                              justify="space-between"
                              gap={3}
                              p={{ base: 3, md: 4 }}
                              bg="white"
                              borderRadius="xl"
                              borderWidth="1px"
                              borderColor={todo.parentChecked ? "#9AE6B4" : "#E2E8F0"}
                            >
                              <VStack align="flex-start" gap={1} flex={1}>
                                {todo.parentChecked && (
                                  <Badge
                                    bg="#48BB78"
                                    color="white"
                                    borderRadius="full"
                                    px={2.5}
                                    py={0.5}
                                    fontSize="xs"
                                    fontWeight="bold"
                                  >
                                    おうちの人 OK!
                                  </Badge>
                                )}
                                <Text
                                  fontSize={{ base: "md", md: "lg" }}
                                  color="#718096"
                                  textDecoration="line-through"
                                  wordBreak="break-word"
                                  w="full"
                                >
                                  {todo.title}
                                </Text>
                              </VStack>

                              <HStack gap={1.5} flexShrink={0}>
                                <Button
                                  onClick={() => handleToggleWithFade(todo.id)}
                                  w="42px"
                                  h="42px"
                                  p={0}
                                  borderRadius="xl"
                                  bg="#EBF8FF"
                                  color="#2B6CB0"
                                  _hover={{ bg: "#BEE3F8" }}
                                  aria-label={`${todo.title} をもどす`}
                                  title="もどす"
                                >
                                  <ArrowCounterClockwise size={20} weight="bold" />
                                </Button>
                                {!todo.locked && (
                                  <Button
                                    onClick={() => setDeleteTarget({ type: "single", todo })}
                                    w="42px"
                                    h="42px"
                                    p={0}
                                    borderRadius="xl"
                                    bg="#EDF2F7"
                                    color="#4A5568"
                                    _hover={{ bg: "#FED7D7", color: "#9B2C2C" }}
                                    aria-label={`${todo.title} をけす`}
                                    title="けす"
                                  >
                                    <Trash size={20} weight="bold" />
                                  </Button>
                                )}
                              </HStack>
                            </Flex>
                          </Box>
                        </Box>
                      );
                    })}
                  </VStack>
                </Box>
              )}
            </>
          )}
        </VStack>
      </Container>

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <Flex
          position="fixed"
          inset={0}
          zIndex={1000}
          bg="rgba(0, 0, 0, 0.45)"
          align="center"
          justify="center"
          p={4}
          onClick={() => setDeleteTarget(null)}
        >
          <Box
            bg="white"
            w="full"
            maxW="400px"
            p={{ base: 6, md: 7 }}
            borderRadius="2xl"
            borderWidth="3px"
            borderColor="#BEE3F8"
            boxShadow="0 10px 30px rgba(0, 0, 0, 0.2)"
            onClick={(e) => e.stopPropagation()}
            textAlign="center"
          >
            <VStack gap={4} align="stretch">
              <Heading as="h3" fontSize="xl" color="#2D3748">
                本当に消しますか？
              </Heading>

              {deleteTarget.type === "single" ? (
                <Box
                  bg="#F8FAFC"
                  p={3.5}
                  borderRadius="xl"
                  borderWidth="1px"
                  borderColor="#E2E8F0"
                >
                  <Text
                    fontSize="lg"
                    fontWeight="bold"
                    color="#2B6CB0"
                    wordBreak="break-word"
                  >
                    「{deleteTarget.todo.title}」
                  </Text>
                </Box>
              ) : (
                <Text fontSize="md" color="#4A5568">
                  できた！リストのタスクを全部消します。
                  <br />
                  <Text as="span" fontSize="sm" color="#718096">
                    （※「これまでの記録」は残るよ）
                  </Text>
                </Text>
              )}

              <HStack gap={3} mt={2}>
                <Button
                  onClick={() => setDeleteTarget(null)}
                  flex={1}
                  h="52px"
                  fontSize="md"
                  fontWeight="bold"
                  borderRadius="xl"
                  bg="#EDF2F7"
                  color="#4A5568"
                  _hover={{ bg: "#E2E8F0" }}
                >
                  やめる
                </Button>
                <Button
                  onClick={handleConfirmDelete}
                  flex={1}
                  h="52px"
                  fontSize="md"
                  fontWeight="bold"
                  borderRadius="xl"
                  bg="#FC8181"
                  color="white"
                  _hover={{ bg: "#F56565" }}
                  _active={{ bg: "#E53E3E" }}
                >
                  消す
                </Button>
              </HStack>
            </VStack>
          </Box>
        </Flex>
      )}
    </Box>
  );
}
