"use client";

import { useState, useMemo, useEffect, KeyboardEvent } from "react";
import {
  Box,
  Button,
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
  X,
  DotsSixVertical,
  Lock,
  LockOpen,
} from "@phosphor-icons/react";
import {
  Todo,
  HistoryRecord,
  TaskTemplate,
  WeeklyAllowances,
  WeeklyAllowanceEntry,
} from "../types";
import { useDragReorder } from "../hooks/useDragReorder";
import { formatWeekRange, getWeekDays } from "../utils/date";

const WEEKDAY_OPTIONS = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
  { value: 0, label: "日" },
];

type AdminViewProps = {
  todos: Todo[];
  history: HistoryRecord[];
  templates: TaskTemplate[];
  weeklyAllowances: WeeklyAllowances;
  adminPin: string;
  onChangePin: (newPin: string) => void;
  onApproveTask: (id: string) => void;
  onUnapproveTask: (id: string) => void;
  onRejectToActive: (id: string) => void;
  onAddTemplate: (title: string, daysOfWeek: number[], locked: boolean) => void;
  onDeleteTemplate: (id: string) => void;
  onEditTemplate: (id: string, newTitle: string) => void;
  onToggleTemplateLock: (id: string) => void;
  onReorderTemplates: (fromIndex: number, toIndex: number) => void;
  onApplyTodayTemplates: () => number;
  onUpdateWeeklyAllowance: (
    weekKey: string,
    update: Partial<WeeklyAllowanceEntry>
  ) => void;
  onExit: () => void;
};

export function AdminView({
  todos,
  history,
  templates,
  weeklyAllowances,
  adminPin,
  onChangePin,
  onApproveTask,
  onUnapproveTask,
  onRejectToActive,
  onAddTemplate,
  onDeleteTemplate,
  onEditTemplate,
  onToggleTemplateLock,
  onReorderTemplates,
  onApplyTodayTemplates,
  onUpdateWeeklyAllowance,
  onExit,
}: AdminViewProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [newPin, setNewPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");

  const [templateTitle, setTemplateTitle] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [templateLocked, setTemplateLocked] = useState(true);
  const [templateMessage, setTemplateMessage] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateTitle, setEditingTemplateTitle] = useState("");

  const [allowanceWeekOffset, setAllowanceWeekOffset] = useState(0);
  const [allowanceInput, setAllowanceInput] = useState("");
  const [allowanceNoteInput, setAllowanceNoteInput] = useState("");
  const [allowanceMessage, setAllowanceMessage] = useState("");

  const allowanceWeekDays = useMemo(
    () => getWeekDays(allowanceWeekOffset),
    [allowanceWeekOffset]
  );
  const allowanceWeekKey = allowanceWeekDays[0]?.dateKey ?? "";
  const currentWeekEntry = weeklyAllowances[allowanceWeekKey];
  const currentWeekAllowance = currentWeekEntry?.amount ?? 0;
  const currentWeekPaid = Boolean(currentWeekEntry?.paid);
  const currentWeekNote = currentWeekEntry?.note ?? "";

  useEffect(() => {
    setAllowanceNoteInput(currentWeekNote);
  }, [allowanceWeekKey, currentWeekNote]);

  const allowanceWeekSummary = useMemo(() => {
    const daySet = new Set(allowanceWeekDays.map((d) => d.dateKey));
    const weekRecords = history.filter((h) => daySet.has(h.dateKey));
    const approvedCount = weekRecords.filter((h) => h.parentChecked).length;
    return {
      totalCount: weekRecords.length,
      approvedCount,
    };
  }, [allowanceWeekDays, history]);

  const {
    containerRef: templateListRef,
    draggingIndex: draggingTemplateIndex,
    startDrag: startTemplateDrag,
    getItemStyle: getTemplateItemStyle,
  } = useDragReorder(onReorderTemplates);

  const handleLogin = () => {
    if (pinInput === adminPin) {
      setIsAuthenticated(true);
      setAuthError("");
      setPinInput("");
    } else {
      setAuthError("パスワードが違います");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      handleLogin();
    }
  };

  const handleUpdatePin = () => {
    const trimmed = newPin.trim();
    if (trimmed.length < 4) {
      setPinMessage("4文字以上で入力してください");
      return;
    }
    onChangePin(trimmed);
    setNewPin("");
    setPinMessage("パスワードを変更しました");
  };

  const handleToggleDay = (dayValue: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayValue)
        ? prev.filter((d) => d !== dayValue)
        : [...prev, dayValue]
    );
    if (templateMessage) setTemplateMessage("");
  };

  const handleCreateTemplate = () => {
    const trimmed = templateTitle.trim();
    if (!trimmed) {
      setTemplateMessage("タスク名を入力してください");
      return;
    }
    if (selectedDays.length === 0) {
      setTemplateMessage("曜日を1つ以上えらんでください");
      return;
    }
    onAddTemplate(trimmed, selectedDays, templateLocked);
    setTemplateTitle("");
    setTemplateMessage("テンプレートを追加しました（今日の分にも反映できます）");
  };

  const handleApplyToday = () => {
    const addedCount = onApplyTodayTemplates();
    if (addedCount > 0) {
      setTemplateMessage(`今日のリストに ${addedCount}件 のタスクを追加しました`);
    } else {
      setTemplateMessage("今日の曜日に追加できる新しいタスクはありません");
    }
  };

  // パスワード認証画面
  if (!isAuthenticated) {
    return (
      <Box
        bg="white"
        p={{ base: 5, md: 8 }}
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#CBD5E0"
        boxShadow="0 4px 14px rgba(144, 205, 244, 0.2)"
      >
        <VStack gap={5} align="stretch" maxW="360px" mx="auto">
          <VStack gap={1} textAlign="center">
            <Badge
              bg="#EDF2F7"
              color="#4A5568"
              px={3}
              py={1}
              borderRadius="full"
              fontSize="xs"
              fontWeight="bold"
            >
              保護者用メニュー
            </Badge>
            <Heading as="h2" fontSize="xl" color="#2D3748" mt={2}>
              おうちの人 パスワード入力
            </Heading>
            <Text fontSize="sm" color="#718096">
              確認機能を開くにはパスワードを入力してください
              <br />
              （初期パスワード: 1234）
            </Text>
          </VStack>

          <Input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value);
              if (authError) setAuthError("");
            }}
            onKeyDown={handleKeyDown}
            placeholder="パスワードを入力"
            size="lg"
            h="52px"
            textAlign="center"
            fontSize="lg"
            bg="#F8FAFC"
            color="#2D3748"
            borderWidth="2px"
            borderColor={authError ? "#FC8181" : "#CBD5E0"}
            borderRadius="xl"
          />

          {authError && (
            <Text color="#E53E3E" fontSize="sm" fontWeight="bold" textAlign="center">
              {authError}
            </Text>
          )}

          <HStack gap={3}>
            <Button
              onClick={onExit}
              flex={1}
              h="48px"
              borderRadius="xl"
              bg="#EDF2F7"
              color="#4A5568"
              fontWeight="bold"
              _hover={{ bg: "#E2E8F0" }}
            >
              もどる
            </Button>
            <Button
              onClick={handleLogin}
              flex={1}
              h="48px"
              borderRadius="xl"
              bg="#4299E1"
              color="white"
              fontWeight="bold"
              _hover={{ bg: "#3182CE" }}
            >
              入る
            </Button>
          </HStack>
        </VStack>
      </Box>
    );
  }

  // 管理者ダッシュボード
  const completedTodos = todos.filter((t) => t.completed);
  const uncheckedTodosCount = completedTodos.filter((t) => !t.parentChecked).length;

  // 履歴の中で現在todosに存在しないもの（リストから消された過去の完了分）も含めて最新順に表示
  const sortedHistory = [...history].sort((a, b) => b.completedAt - a.completedAt);
  const uncheckedHistoryCount = sortedHistory.filter((h) => !h.parentChecked).length;

  return (
    <VStack gap={6} align="stretch">
      {/* 管理者バー */}
      <Flex
        bg="#2D3748"
        color="white"
        p={{ base: 4, md: 5 }}
        borderRadius="2xl"
        justify="space-between"
        align="center"
        flexWrap="wrap"
        gap={3}
      >
        <VStack align="flex-start" gap={0}>
          <HStack gap={2}>
            <Text fontSize="lg" fontWeight="bold">
              おうちの人（管理）モード
            </Text>
            {uncheckedHistoryCount > 0 && (
              <Badge
                bg="#F6AD55"
                color="white"
                px={2.5}
                py={0.5}
                borderRadius="full"
                fontSize="xs"
                fontWeight="bold"
              >
                未確認 {uncheckedHistoryCount}件
              </Badge>
            )}
          </HStack>
          <Text fontSize="xs" color="#CBD5E0">
            お子さまが「できた！」にしたタスクをチェック・差し戻しできます
          </Text>
        </VStack>

        <Button
          onClick={onExit}
          h="42px"
          px={4}
          borderRadius="xl"
          bg="#4A5568"
          color="white"
          fontSize="sm"
          fontWeight="bold"
          _hover={{ bg: "#718096" }}
        >
          子供画面にもどる
        </Button>
      </Flex>

      {/* 1週間ごとのおこづかい登録 */}
      <Box
        bg="white"
        p={{ base: 4, md: 6 }}
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#9AE6B4"
        boxShadow="0 4px 12px rgba(72, 187, 120, 0.12)"
      >
        <Flex justify="space-between" align="center" mb={4} gap={2} flexWrap="wrap">
          <VStack align="flex-start" gap={0}>
            <Heading as="h2" fontSize="lg" color="#276749">
              週ごとのおこづかい登録
            </Heading>
            <Text fontSize="xs" color="#718096">
              1日の様子をみて、今週もらえるおこづかいを増減・登録できます
            </Text>
          </VStack>
          <Badge
            bg="#F0FFF4"
            color="#2F855A"
            px={3}
            py={1}
            borderRadius="full"
            fontSize="xs"
            fontWeight="bold"
          >
            この週の達成: {allowanceWeekSummary.totalCount}件（OK {allowanceWeekSummary.approvedCount}件）
          </Badge>
        </Flex>

        {/* 週選択ナビゲーション */}
        <Flex justify="space-between" align="center" mb={4} gap={2}>
          <Button
            onClick={() => {
              setAllowanceWeekOffset((prev) => prev - 1);
              setAllowanceMessage("");
            }}
            h="38px"
            px={3}
            fontSize="xs"
            fontWeight="bold"
            borderRadius="xl"
            bg="#EBF8FF"
            color="#2B6CB0"
            _hover={{ bg: "#BEE3F8" }}
          >
            ◀ まえの週
          </Button>

          <VStack gap={0} textAlign="center">
            <Text fontSize="xs" fontWeight="bold" color="#718096">
              {allowanceWeekOffset === 0
                ? "こんしゅう"
                : allowanceWeekOffset === -1
                ? "せんしゅう"
                : `${Math.abs(allowanceWeekOffset)}しゅうまえ`}
            </Text>
            <Text fontSize="sm" fontWeight="bold" color="#2D3748">
              {formatWeekRange(allowanceWeekDays)}
            </Text>
          </VStack>

          <Button
            onClick={() => {
              setAllowanceWeekOffset((prev) => prev + 1);
              setAllowanceMessage("");
            }}
            disabled={allowanceWeekOffset >= 0}
            h="38px"
            px={3}
            fontSize="xs"
            fontWeight="bold"
            borderRadius="xl"
            bg="#EBF8FF"
            color="#2B6CB0"
            _hover={{ bg: "#BEE3F8" }}
            _disabled={{
              bg: "#EDF2F7",
              color: "#A0AEC0",
              cursor: "not-allowed",
            }}
          >
            つぎの週 ▶
          </Button>
        </Flex>

        {/* 現在の登録金額表示 & わたしたよ記録 */}
        <Flex
          bg="#F0FFF4"
          borderWidth="1px"
          borderColor="#9AE6B4"
          borderRadius="xl"
          p={4}
          mb={4}
          justify="space-between"
          align="center"
          flexWrap="wrap"
          gap={3}
        >
          <VStack align={{ base: "center", sm: "flex-start" }} gap={0} flex={1}>
            <Text fontSize="xs" fontWeight="bold" color="#276749">
              現在登録されている金額
            </Text>
            <Text fontSize="3xl" fontWeight="bold" color="#2F855A">
              {currentWeekAllowance.toLocaleString()}
              <Text as="span" fontSize="md" ml={1}>
                円
              </Text>
            </Text>
          </VStack>

          <Button
            onClick={() => {
              const nextPaid = !currentWeekPaid;
              onUpdateWeeklyAllowance(allowanceWeekKey, { paid: nextPaid });
              setAllowanceMessage(
                nextPaid ? "「わたしたよ！」を記録しました" : "未渡しに戻しました"
              );
            }}
            h="44px"
            px={4}
            borderRadius="xl"
            bg={currentWeekPaid ? "#48BB78" : "white"}
            color={currentWeekPaid ? "white" : "#276749"}
            borderWidth="2px"
            borderColor="#48BB78"
            fontWeight="bold"
            fontSize="sm"
            _hover={{
              bg: currentWeekPaid ? "#38A169" : "#E6FFFA",
            }}
          >
            {currentWeekPaid ? "✓ わたした済み！" : "わたしたよにする"}
          </Button>
        </Flex>

        {/* クイック増減ボタン */}
        <HStack gap={2} flexWrap="wrap" justify="center" mb={4}>
          {[
            { label: "+10円", delta: 10, bg: "#EBF8FF", color: "#2B6CB0", hover: "#BEE3F8" },
            { label: "+50円", delta: 50, bg: "#EBF8FF", color: "#2B6CB0", hover: "#BEE3F8" },
            { label: "+100円", delta: 100, bg: "#C6F6D5", color: "#22543D", hover: "#9AE6B4" },
            { label: "-50円", delta: -50, bg: "#EDF2F7", color: "#4A5568", hover: "#E2E8F0" },
          ].map((btn) => (
            <Button
              key={btn.label}
              onClick={() => {
                const nextAmount = Math.max(0, currentWeekAllowance + btn.delta);
                onUpdateWeeklyAllowance(allowanceWeekKey, { amount: nextAmount });
                setAllowanceMessage(`${nextAmount.toLocaleString()}円に更新しました`);
              }}
              h="42px"
              px={4}
              fontSize="sm"
              fontWeight="bold"
              borderRadius="xl"
              bg={btn.bg}
              color={btn.color}
              _hover={{ bg: btn.hover }}
            >
              {btn.label}
            </Button>
          ))}
        </HStack>

        {/* 直接入力フォーム */}
        <Flex direction={{ base: "column", sm: "row" }} gap={2.5} mb={4}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={allowanceInput}
            onChange={(e) => {
              setAllowanceInput(e.target.value);
              if (allowanceMessage) setAllowanceMessage("");
            }}
            placeholder="金額を直接入力（例: 500）"
            h="46px"
            bg="#F8FAFC"
            borderWidth="2px"
            borderColor="#CBD5E0"
            borderRadius="xl"
          />
          <Button
            onClick={() => {
              const parsed = Number(allowanceInput);
              if (allowanceInput.trim() === "" || Number.isNaN(parsed) || parsed < 0) {
                setAllowanceMessage("0以上の数字を入力してください");
                return;
              }
              const amount = Math.floor(parsed);
              onUpdateWeeklyAllowance(allowanceWeekKey, { amount });
              setAllowanceInput("");
              setAllowanceMessage(`${amount.toLocaleString()}円を登録しました`);
            }}
            h="46px"
            px={6}
            borderRadius="xl"
            bg="#48BB78"
            color="white"
            fontWeight="bold"
            _hover={{ bg: "#38A169" }}
            flexShrink={0}
          >
            金額を登録
          </Button>
        </Flex>

        {/* 親からのひと言メモ */}
        <Box pt={3} borderTopWidth="1px" borderColor="#E2E8F0">
          <Text fontSize="xs" fontWeight="bold" color="#4A5568" mb={1.5}>
            お子さまへのひと言メモ（「これまでの きろく」に表示されます）
          </Text>
          <Flex direction={{ base: "column", sm: "row" }} gap={2.5}>
            <Input
              value={allowanceNoteInput}
              onChange={(e) => {
                setAllowanceNoteInput(e.target.value);
                if (allowanceMessage) setAllowanceMessage("");
              }}
              placeholder="例：今週はしゅくだいを毎日がんばったね！"
              h="44px"
              bg="#F8FAFC"
              borderWidth="2px"
              borderColor="#CBD5E0"
              borderRadius="xl"
            />
            <Button
              onClick={() => {
                onUpdateWeeklyAllowance(allowanceWeekKey, {
                  note: allowanceNoteInput.trim(),
                });
                setAllowanceMessage("ひと言メモを保存しました");
              }}
              h="44px"
              px={5}
              borderRadius="xl"
              bg="#4299E1"
              color="white"
              fontWeight="bold"
              _hover={{ bg: "#3182CE" }}
              flexShrink={0}
            >
              メモを保存
            </Button>
          </Flex>
        </Box>

        {allowanceMessage && (
          <Text mt={2} fontSize="xs" fontWeight="bold" color="#2F855A">
            {allowanceMessage}
          </Text>
        )}
      </Box>

      {/* 現在の「できた！」リストのチェック */}
      <Box
        bg="white"
        p={{ base: 4, md: 6 }}
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#CFE2FF"
        boxShadow="0 4px 12px rgba(144, 205, 244, 0.15)"
      >
        <Flex justify="space-between" align="center" mb={4} gap={2} flexWrap="wrap">
          <Heading as="h2" fontSize="lg" color="#2D3748">
            現在の「できた！」リストの確認
          </Heading>
          <Badge
            bg={uncheckedTodosCount > 0 ? "#FFF3E0" : "#EBF8FF"}
            color={uncheckedTodosCount > 0 ? "#C05621" : "#2B6CB0"}
            px={3}
            py={1}
            borderRadius="full"
            fontSize="xs"
            fontWeight="bold"
          >
            確認まち: {uncheckedTodosCount}件
          </Badge>
        </Flex>

        {completedTodos.length === 0 ? (
          <Box
            bg="#F7FAFC"
            borderRadius="xl"
            p={5}
            textAlign="center"
            borderWidth="1px"
            borderColor="#E2E8F0"
          >
            <Text fontSize="sm" color="#718096">
              現在「できた！リスト」にあるタスクはありません
            </Text>
          </Box>
        ) : (
          <VStack gap={3} align="stretch">
            {completedTodos.map((todo) => (
              <Flex
                key={todo.id}
                align={{ base: "stretch", sm: "center" }}
                justify="space-between"
                gap={3}
                p={4}
                bg={todo.parentChecked ? "#F0FFF4" : "#FFFBF5"}
                borderRadius="xl"
                borderWidth="2px"
                borderColor={todo.parentChecked ? "#9AE6B4" : "#FBD38D"}
                direction={{ base: "column", sm: "row" }}
              >
                <VStack align="flex-start" gap={1} flex={1}>
                  <HStack gap={2} flexWrap="wrap">
                    <Badge
                      bg={todo.parentChecked ? "#48BB78" : "#ED8936"}
                      color="white"
                      px={2}
                      py={0.5}
                      borderRadius="full"
                      fontSize="xs"
                    >
                      {todo.parentChecked ? "確認ずみ OK" : "確認まち"}
                    </Badge>
                    {todo.completedAt && (
                      <Text fontSize="xs" color="#718096">
                        完了: {new Date(todo.completedAt).toLocaleString("ja-JP")}
                      </Text>
                    )}
                  </HStack>
                  <Text fontSize="md" fontWeight="bold" color="#2D3748">
                    {todo.title}
                  </Text>
                </VStack>

                <HStack gap={2} justify="flex-end">
                  {todo.parentChecked ? (
                    <Button
                      onClick={() => onUnapproveTask(todo.id)}
                      h="42px"
                      px={3}
                      fontSize="xs"
                      fontWeight="bold"
                      borderRadius="xl"
                      bg="#EDF2F7"
                      color="#4A5568"
                      _hover={{ bg: "#E2E8F0" }}
                    >
                      確認をとりけす
                    </Button>
                  ) : (
                    <Button
                      onClick={() => onApproveTask(todo.id)}
                      h="42px"
                      px={4}
                      fontSize="sm"
                      fontWeight="bold"
                      borderRadius="xl"
                      bg="#48BB78"
                      color="white"
                      _hover={{ bg: "#38A169" }}
                    >
                      OK!（確認）
                    </Button>
                  )}

                  <Button
                    onClick={() => onRejectToActive(todo.id)}
                    h="42px"
                    px={3}
                    fontSize="xs"
                    fontWeight="bold"
                    borderRadius="xl"
                    bg="#FED7D7"
                    color="#9B2C2C"
                    _hover={{ bg: "#FEB2B2" }}
                  >
                    やりなおし
                  </Button>
                </HStack>
              </Flex>
            ))}
          </VStack>
        )}
      </Box>

      {/* これまでの履歴全体のチェック */}
      <Box
        bg="white"
        p={{ base: 4, md: 6 }}
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#CFE2FF"
        boxShadow="0 4px 12px rgba(144, 205, 244, 0.15)"
      >
        <Heading as="h2" fontSize="lg" color="#2D3748" mb={4}>
          これまでの達成履歴のチェック（全 {sortedHistory.length}件）
        </Heading>

        {sortedHistory.length === 0 ? (
          <Box
            bg="#F7FAFC"
            borderRadius="xl"
            p={5}
            textAlign="center"
            borderWidth="1px"
            borderColor="#E2E8F0"
          >
            <Text fontSize="sm" color="#718096">
              まだ達成履歴がありません
            </Text>
          </Box>
        ) : (
          <VStack gap={2.5} align="stretch" maxH="360px" overflowY="auto" pr={1}>
            {sortedHistory.map((record) => (
              <Flex
                key={`${record.id}-${record.completedAt}`}
                align={{ base: "stretch", sm: "center" }}
                justify="space-between"
                gap={3}
                p={3.5}
                bg={record.parentChecked ? "#F8FAFC" : "#FFFBF5"}
                borderRadius="xl"
                borderWidth="1px"
                borderColor={record.parentChecked ? "#E2E8F0" : "#FBD38D"}
                direction={{ base: "column", sm: "row" }}
              >
                <VStack align="flex-start" gap={0.5} flex={1}>
                  <HStack gap={2}>
                    <Badge
                      bg={record.parentChecked ? "#48BB78" : "#ED8936"}
                      color="white"
                      px={2}
                      py={0.5}
                      borderRadius="full"
                      fontSize="10px"
                    >
                      {record.parentChecked ? "OKずみ" : "未確認"}
                    </Badge>
                    <Text fontSize="xs" color="#718096">
                      {new Date(record.completedAt).toLocaleString("ja-JP")}
                    </Text>
                  </HStack>
                  <Text fontSize="sm" fontWeight="bold" color="#2D3748">
                    {record.title}
                  </Text>
                </VStack>

                <HStack gap={2} justify="flex-end">
                  {record.parentChecked ? (
                    <Button
                      onClick={() => onUnapproveTask(record.id)}
                      h="36px"
                      px={3}
                      fontSize="xs"
                      borderRadius="lg"
                      bg="#EDF2F7"
                      color="#4A5568"
                      _hover={{ bg: "#E2E8F0" }}
                    >
                      とりけす
                    </Button>
                  ) : (
                    <Button
                      onClick={() => onApproveTask(record.id)}
                      h="36px"
                      px={3}
                      fontSize="xs"
                      fontWeight="bold"
                      borderRadius="lg"
                      bg="#48BB78"
                      color="white"
                      _hover={{ bg: "#38A169" }}
                    >
                      OK!
                    </Button>
                  )}
                </HStack>
              </Flex>
            ))}
          </VStack>
        )}
      </Box>

      {/* 曜日ごとのタスクテンプレート設定 */}
      <Box
        bg="white"
        p={{ base: 4, md: 6 }}
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#CFE2FF"
        boxShadow="0 4px 12px rgba(144, 205, 244, 0.15)"
      >
        <Flex justify="space-between" align="center" mb={3} gap={2} flexWrap="wrap">
          <VStack align="flex-start" gap={0}>
            <Heading as="h2" fontSize="lg" color="#2D3748">
              曜日ごとの定型タスク（テンプレート）
            </Heading>
            <Text fontSize="xs" color="#718096">
              トップ画面の「テンプレートから ついか」や「きょうの分を まとめてついか」から手動で追加できます
            </Text>
          </VStack>
          <Button
            onClick={handleApplyToday}
            h="38px"
            px={3}
            fontSize="xs"
            fontWeight="bold"
            borderRadius="xl"
            bg="#FFF3E0"
            color="#C05621"
            borderWidth="1px"
            borderColor="#FBD38D"
            _hover={{ bg: "#FEEBC8" }}
          >
            今日の分を今すぐ追加
          </Button>
        </Flex>

        {/* テンプレート追加フォーム */}
        <VStack
          gap={3}
          align="stretch"
          bg="#F8FAFC"
          p={4}
          borderRadius="xl"
          borderWidth="1px"
          borderColor="#E2E8F0"
          mb={4}
        >
          <Input
            value={templateTitle}
            onChange={(e) => {
              setTemplateTitle(e.target.value);
              if (templateMessage) setTemplateMessage("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                handleCreateTemplate();
              }
            }}
            placeholder="定型タスク名（例：しゅくだい、はみがき）"
            h="46px"
            bg="white"
            borderWidth="2px"
            borderColor="#CBD5E0"
            borderRadius="xl"
          />

          <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
            <HStack gap={1.5} flexWrap="wrap">
              {WEEKDAY_OPTIONS.map((opt) => {
                const isSelected = selectedDays.includes(opt.value);
                return (
                  <Button
                    key={opt.value}
                    onClick={() => handleToggleDay(opt.value)}
                    w="38px"
                    h="38px"
                    p={0}
                    fontSize="sm"
                    fontWeight="bold"
                    borderRadius="lg"
                    borderWidth="2px"
                    borderColor={isSelected ? "#4299E1" : "#CBD5E0"}
                    bg={isSelected ? "#63B3ED" : "white"}
                    color={isSelected ? "white" : "#4A5568"}
                    _hover={{
                      bg: isSelected ? "#4299E1" : "#EDF2F7",
                    }}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </HStack>

            <HStack gap={1.5}>
              <Button
                onClick={() => setSelectedDays([1, 2, 3, 4, 5, 6, 0])}
                size="xs"
                h="30px"
                px={2.5}
                borderRadius="md"
                bg="#EBF8FF"
                color="#2B6CB0"
                _hover={{ bg: "#BEE3F8" }}
              >
                毎日
              </Button>
              <Button
                onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                size="xs"
                h="30px"
                px={2.5}
                borderRadius="md"
                bg="#EBF8FF"
                color="#2B6CB0"
                _hover={{ bg: "#BEE3F8" }}
              >
                平日
              </Button>
              <Button
                onClick={() => setSelectedDays([6, 0])}
                size="xs"
                h="30px"
                px={2.5}
                borderRadius="md"
                bg="#EBF8FF"
                color="#2B6CB0"
                _hover={{ bg: "#BEE3F8" }}
              >
                土日
              </Button>
            </HStack>
          </Flex>

          <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
            <Button
              onClick={() => setTemplateLocked((prev) => !prev)}
              size="sm"
              h="36px"
              px={3}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={templateLocked ? "#ED8936" : "#CBD5E0"}
              bg={templateLocked ? "#FFF8F0" : "white"}
              color={templateLocked ? "#C05621" : "#4A5568"}
              fontWeight="bold"
              fontSize="xs"
              _hover={{
                bg: templateLocked ? "#FEEBC8" : "#EDF2F7",
              }}
            >
              <HStack gap={1.5}>
                {templateLocked ? <Lock size={15} weight="bold" /> : <LockOpen size={15} weight="bold" />}
                <Text>
                  {templateLocked
                    ? "お子さまによる編集・削除を禁止（ロック中）"
                    : "お子さまでも編集・削除OK"}
                </Text>
              </HStack>
            </Button>
          </Flex>

          <Button
            onClick={handleCreateTemplate}
            h="44px"
            borderRadius="xl"
            bg="#4299E1"
            color="white"
            fontWeight="bold"
            _hover={{ bg: "#3182CE" }}
          >
            テンプレートを追加
          </Button>

          {templateMessage && (
            <Text fontSize="xs" fontWeight="bold" color="#2B6CB0">
              {templateMessage}
            </Text>
          )}
        </VStack>

        {/* 登録済みテンプレート一覧 */}
        {templates.length === 0 ? (
          <Text fontSize="sm" color="#718096" textAlign="center" py={2}>
            登録されているテンプレートはありません
          </Text>
        ) : (
          <VStack ref={templateListRef} gap={2.5} align="stretch">
            {templates.map((tpl, index) => {
              const isDragging = draggingTemplateIndex === index;
              const isEditing = editingTemplateId === tpl.id;
              return (
                <Flex
                  key={tpl.id}
                  style={getTemplateItemStyle(index)}
                  align="center"
                  justify="space-between"
                  gap={3}
                  p={3.5}
                  bg={isDragging ? "#FFFBF5" : "#F8FBFF"}
                  borderRadius="xl"
                  borderWidth={isEditing || isDragging ? "2px" : "1px"}
                  borderColor={
                    isEditing ? "#4299E1" : isDragging ? "#F6AD55" : "#BEE3F8"
                  }
                  boxShadow={isDragging ? "0 12px 28px rgba(43, 108, 176, 0.25)" : "none"}
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={editingTemplateTitle}
                        onChange={(e) => setEditingTemplateTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            if (editingTemplateTitle.trim()) {
                              onEditTemplate(tpl.id, editingTemplateTitle);
                              setEditingTemplateId(null);
                              setEditingTemplateTitle("");
                            }
                          } else if (e.key === "Escape") {
                            setEditingTemplateId(null);
                            setEditingTemplateTitle("");
                          }
                        }}
                        autoFocus
                        h="40px"
                        bg="white"
                        borderWidth="2px"
                        borderColor="#63B3ED"
                        borderRadius="lg"
                        flex={1}
                      />
                      <HStack gap={1.5} flexShrink={0}>
                        <Button
                          onClick={() => {
                            if (!editingTemplateTitle.trim()) return;
                            onEditTemplate(tpl.id, editingTemplateTitle);
                            setEditingTemplateId(null);
                            setEditingTemplateTitle("");
                          }}
                          disabled={!editingTemplateTitle.trim()}
                          w="38px"
                          h="38px"
                          p={0}
                          borderRadius="lg"
                          bg="#4299E1"
                          color="white"
                          _hover={{ bg: "#3182CE" }}
                          aria-label="保存"
                          title="保存"
                        >
                          <Check size={18} weight="bold" />
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingTemplateId(null);
                            setEditingTemplateTitle("");
                          }}
                          w="38px"
                          h="38px"
                          p={0}
                          borderRadius="lg"
                          bg="#EDF2F7"
                          color="#4A5568"
                          _hover={{ bg: "#E2E8F0" }}
                          aria-label="取消"
                          title="取消"
                        >
                          <X size={18} weight="bold" />
                        </Button>
                      </HStack>
                    </>
                  ) : (
                    <>
                      <Flex
                        onPointerDown={(e) => startTemplateDrag(index, e)}
                        style={{ touchAction: "none" }}
                        cursor={isDragging ? "grabbing" : "grab"}
                        w="32px"
                        h="40px"
                        align="center"
                        justify="center"
                        borderRadius="lg"
                        bg="#EBF8FF"
                        color="#4299E1"
                        userSelect="none"
                        flexShrink={0}
                        title="ドラッグして順番をかえる"
                      >
                        <DotsSixVertical size={20} weight="bold" />
                      </Flex>

                      <VStack align="flex-start" gap={1.5} flex={1}>
                        <HStack gap={2} flexWrap="wrap">
                          <Text fontSize="md" fontWeight="bold" color="#2D3748" wordBreak="break-word">
                            {tpl.title}
                          </Text>
                          {tpl.locked && (
                            <Badge
                              bg="#FFF3E0"
                              color="#C05621"
                              px={2}
                              py={0.5}
                              borderRadius="full"
                              fontSize="10px"
                              fontWeight="bold"
                            >
                              ロック中
                            </Badge>
                          )}
                        </HStack>
                        <HStack gap={1} flexWrap="wrap">
                          {WEEKDAY_OPTIONS.filter((opt) =>
                            tpl.daysOfWeek.includes(opt.value)
                          ).map((opt) => (
                            <Badge
                              key={opt.value}
                              bg="#EBF8FF"
                              color="#2B6CB0"
                              px={2}
                              py={0.5}
                              borderRadius="md"
                              fontSize="xs"
                              fontWeight="bold"
                            >
                              {opt.label}
                            </Badge>
                          ))}
                        </HStack>
                      </VStack>

                      <HStack gap={1.5} flexShrink={0}>
                        <Button
                          onClick={() => onToggleTemplateLock(tpl.id)}
                          w="38px"
                          h="38px"
                          p={0}
                          borderRadius="lg"
                          bg={tpl.locked ? "#FFF3E0" : "#EDF2F7"}
                          color={tpl.locked ? "#C05621" : "#718096"}
                          _hover={{
                            bg: tpl.locked ? "#FEEBC8" : "#E2E8F0",
                          }}
                          aria-label={tpl.locked ? "ロックを解除" : "編集・削除をロック"}
                          title={tpl.locked ? "ロック中（クリックで解除）" : "ロックなし（クリックでロック）"}
                        >
                          {tpl.locked ? <Lock size={18} weight="bold" /> : <LockOpen size={18} weight="bold" />}
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingTemplateId(tpl.id);
                            setEditingTemplateTitle(tpl.title);
                          }}
                          w="38px"
                          h="38px"
                          p={0}
                          borderRadius="lg"
                          bg="#EBF8FF"
                          color="#2B6CB0"
                          _hover={{ bg: "#BEE3F8" }}
                          aria-label={`${tpl.title} を編集`}
                          title="編集"
                        >
                          <PencilSimple size={18} weight="bold" />
                        </Button>
                        <Button
                          onClick={() => onDeleteTemplate(tpl.id)}
                          w="38px"
                          h="38px"
                          p={0}
                          borderRadius="lg"
                          bg="#EDF2F7"
                          color="#4A5568"
                          _hover={{ bg: "#FED7D7", color: "#9B2C2C" }}
                          aria-label={`${tpl.title} を削除`}
                          title="削除"
                        >
                          <Trash size={18} weight="bold" />
                        </Button>
                      </HStack>
                    </>
                  )}
                </Flex>
              );
            })}
          </VStack>
        )}
      </Box>

      {/* パスワード変更 */}
      <Box
        bg="white"
        p={{ base: 4, md: 6 }}
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#E2E8F0"
      >
        <Heading as="h2" fontSize="md" color="#2D3748" mb={3}>
          管理者パスワードの変更
        </Heading>
        <Flex direction={{ base: "column", sm: "row" }} gap={3}>
          <Input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => {
              setNewPin(e.target.value);
              if (pinMessage) setPinMessage("");
            }}
            placeholder="新しいパスワード（4文字以上）"
            h="46px"
            bg="#F8FAFC"
            borderWidth="2px"
            borderColor="#CBD5E0"
            borderRadius="xl"
          />
          <Button
            onClick={handleUpdatePin}
            h="46px"
            px={6}
            borderRadius="xl"
            bg="#4299E1"
            color="white"
            fontWeight="bold"
            _hover={{ bg: "#3182CE" }}
            flexShrink={0}
          >
            変更する
          </Button>
        </Flex>
        {pinMessage && (
          <Text mt={2} fontSize="sm" fontWeight="bold" color="#2B6CB0">
            {pinMessage}
          </Text>
        )}
      </Box>
    </VStack>
  );
}
