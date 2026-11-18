"use client";

import { useState, useMemo, KeyboardEvent } from "react";
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
import { Trash, CalendarPlus, ArrowBendUpLeft } from "@phosphor-icons/react";
import { Segment, TaskTemplate, Todo } from "../types";
import {
  formatDateKey,
  formatDateWithWeekday,
  getOffsetDateKey,
} from "../utils/date";

type ScheduleViewProps = {
  todos: Todo[];
  segments: Segment[];
  templates: TaskTemplate[];
  onAddScheduledTodo: (
    title: string,
    targetDate: string,
    segmentId?: string,
    locked?: boolean
  ) => void;
  onMoveToToday: (id: string) => void;
  onDeleteScheduledTodo: (todo: Todo) => void;
};

export function ScheduleView({
  todos,
  segments,
  templates,
  onAddScheduledTodo,
  onMoveToToday,
  onDeleteScheduledTodo,
}: ScheduleViewProps) {
  const todayKey = formatDateKey(new Date());
  const tomorrowKey = getOffsetDateKey(1);
  const dayAfterTomorrowKey = getOffsetDateKey(2);

  const [selectedDate, setSelectedDate] = useState<string>(tomorrowKey);
  const [titleInput, setTitleInput] = useState("");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [showTemplates, setShowTemplates] = useState(false);

  const segmentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const seg of segments) {
      map.set(seg.id, seg.name);
    }
    return map;
  }, [segments]);

  // 未来の日付（targetDate > todayKey）の未完了タスクを日付ごとにグループ化
  const groupedFutureTodos = useMemo(() => {
    const future = todos.filter(
      (t) => !t.completed && t.targetDate && t.targetDate > todayKey
    );
    const map = new Map<string, Todo[]>();
    for (const todo of future) {
      const dateKey = todo.targetDate!;
      const list = map.get(dateKey) ?? [];
      list.push(todo);
      map.set(dateKey, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [todos, todayKey]);

  const handleAdd = () => {
    const trimmed = titleInput.trim();
    if (!trimmed || !selectedDate) return;
    onAddScheduledTodo(trimmed, selectedDate, selectedSegmentId || undefined, false);
    setTitleInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      handleAdd();
    }
  };

  return (
    <VStack gap={6} align="stretch">
      {/* 予定の事前登録フォーム */}
      <Box
        bg="white"
        p={{ base: 4, md: 6 }}
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#CFE2FF"
        boxShadow="0 4px 12px rgba(144, 205, 244, 0.15)"
      >
        <Heading as="h2" fontSize="lg" color="#2D3748" mb={3}>
          未来の予定を登録する
        </Heading>

        <VStack gap={3} align="stretch">
          {/* 日付選択 */}
          <Flex gap={2} flexWrap="wrap" align="center">
            <Button
              onClick={() => setSelectedDate(tomorrowKey)}
              size="sm"
              h="38px"
              px={3.5}
              borderRadius="xl"
              bg={selectedDate === tomorrowKey ? "#63B3ED" : "#EBF8FF"}
              color={selectedDate === tomorrowKey ? "white" : "#2B6CB0"}
              fontWeight="bold"
              _hover={{
                bg: selectedDate === tomorrowKey ? "#4299E1" : "#BEE3F8",
              }}
            >
              明日（{formatDateWithWeekday(tomorrowKey)}）
            </Button>
            <Button
              onClick={() => setSelectedDate(dayAfterTomorrowKey)}
              size="sm"
              h="38px"
              px={3.5}
              borderRadius="xl"
              bg={selectedDate === dayAfterTomorrowKey ? "#63B3ED" : "#EBF8FF"}
              color={selectedDate === dayAfterTomorrowKey ? "white" : "#2B6CB0"}
              fontWeight="bold"
              _hover={{
                bg: selectedDate === dayAfterTomorrowKey ? "#4299E1" : "#BEE3F8",
              }}
            >
              明後日（{formatDateWithWeekday(dayAfterTomorrowKey)}）
            </Button>
            <Input
              type="date"
              min={tomorrowKey}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              w="auto"
              h="38px"
              fontSize="sm"
              fontWeight="bold"
              bg="#F8FAFC"
              borderWidth="2px"
              borderColor="#CBD5E0"
              borderRadius="xl"
            />
          </Flex>

          {/* セグメント選択 */}
          {segments.length > 0 && (
            <HStack gap={1.5} flexWrap="wrap">
              <Button
                onClick={() => setSelectedSegmentId("")}
                size="xs"
                h="32px"
                px={3}
                borderRadius="full"
                bg={selectedSegmentId === "" ? "#4A5568" : "#EDF2F7"}
                color={selectedSegmentId === "" ? "white" : "#4A5568"}
                fontWeight="bold"
              >
                指定なし
              </Button>
              {segments.map((seg) => (
                <Button
                  key={seg.id}
                  onClick={() => setSelectedSegmentId(seg.id)}
                  size="xs"
                  h="32px"
                  px={3}
                  borderRadius="full"
                  bg={selectedSegmentId === seg.id ? "#4299E1" : "#EBF8FF"}
                  color={selectedSegmentId === seg.id ? "white" : "#2B6CB0"}
                  fontWeight="bold"
                >
                  {seg.name}
                </Button>
              ))}
            </HStack>
          )}

          {/* タスク名入力 */}
          <Flex direction={{ base: "column", sm: "row" }} gap={2.5}>
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="予定のタスクを書いてね（例：習字セットの準備）"
              h="50px"
              fontSize="md"
              bg="#F8FAFC"
              borderWidth="2px"
              borderColor="#CBD5E0"
              borderRadius="xl"
            />
            <Button
              onClick={handleAdd}
              disabled={!titleInput.trim() || !selectedDate}
              h="50px"
              px={6}
              borderRadius="xl"
              bg="#63B3ED"
              color="white"
              fontWeight="bold"
              _hover={{ bg: "#4299E1" }}
              flexShrink={0}
            >
              <HStack gap={1.5}>
                <CalendarPlus size={20} weight="bold" />
                <Text>予定に追加</Text>
              </HStack>
            </Button>
          </Flex>

          {/* テンプレートから予定へ追加 */}
          {templates.length > 0 && (
            <Box pt={2} borderTopWidth="1px" borderColor="#EDF2F7">
              <Button
                onClick={() => setShowTemplates((prev) => !prev)}
                size="xs"
                h="32px"
                px={3}
                borderRadius="lg"
                bg="#EBF8FF"
                color="#2B6CB0"
                fontWeight="bold"
              >
                {showTemplates
                  ? "テンプレートをとじる"
                  : `${formatDateWithWeekday(selectedDate)} にテンプレートから追加`}
              </Button>

              {showTemplates && (
                <Flex mt={2.5} gap={2} flexWrap="wrap">
                  {templates.map((tpl) => (
                    <Button
                      key={tpl.id}
                      onClick={() =>
                        onAddScheduledTodo(
                          tpl.title,
                          selectedDate,
                          tpl.segmentId,
                          tpl.locked
                        )
                      }
                      size="sm"
                      h="36px"
                      px={3}
                      borderRadius="xl"
                      bg="#F8FBFF"
                      borderWidth="1px"
                      borderColor="#BEE3F8"
                      color="#2B6CB0"
                      fontWeight="bold"
                      _hover={{ bg: "#EBF8FF" }}
                    >
                      + {tpl.title}
                    </Button>
                  ))}
                </Flex>
              )}
            </Box>
          )}
        </VStack>
      </Box>

      {/* 日付ごとの予約一覧 */}
      <Box
        bg="white"
        p={{ base: 4, md: 6 }}
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#CFE2FF"
        boxShadow="0 4px 12px rgba(144, 205, 244, 0.15)"
      >
        <Heading as="h2" fontSize="lg" color="#2D3748" mb={4}>
          これからの予定一覧
        </Heading>

        {groupedFutureTodos.length === 0 ? (
          <Box
            bg="#F7FAFC"
            borderRadius="xl"
            p={6}
            textAlign="center"
            borderWidth="2px"
            borderStyle="dashed"
            borderColor="#CBD5E0"
          >
            <Text fontSize="md" color="#718096">
              予約されている予定はまだないよ
            </Text>
          </Box>
        ) : (
          <VStack gap={5} align="stretch">
            {groupedFutureTodos.map(([dateKey, items]) => {
              const isTomorrow = dateKey === tomorrowKey;
              return (
                <Box key={dateKey}>
                  <HStack mb={2.5} gap={2}>
                    <Badge
                      bg={isTomorrow ? "#FFF3E0" : "#EBF8FF"}
                      color={isTomorrow ? "#C05621" : "#2B6CB0"}
                      px={3}
                      py={1}
                      borderRadius="full"
                      fontSize="sm"
                      fontWeight="bold"
                    >
                      {formatDateWithWeekday(dateKey)}
                      {isTomorrow ? " ・明日" : ""}
                    </Badge>
                    <Text fontSize="xs" color="#718096" fontWeight="bold">
                      {items.length}個
                    </Text>
                  </HStack>

                  <VStack gap={2} align="stretch">
                    {items.map((todo) => {
                      const segName = todo.segmentId
                        ? segmentMap.get(todo.segmentId)
                        : undefined;
                      return (
                        <Flex
                          key={todo.id}
                          align="center"
                          justify="space-between"
                          gap={2.5}
                          p={3.5}
                          bg="#F8FBFF"
                          borderRadius="xl"
                          borderWidth="1px"
                          borderColor="#BEE3F8"
                        >
                          <VStack align="flex-start" gap={0.5} flex={1}>
                            {segName && (
                              <Badge
                                bg="#EBF8FF"
                                color="#2B6CB0"
                                px={2}
                                py={0.5}
                                borderRadius="md"
                                fontSize="10px"
                                fontWeight="bold"
                              >
                                {segName}
                              </Badge>
                            )}
                            <Text
                              fontSize="md"
                              fontWeight="bold"
                              color="#2D3748"
                              wordBreak="break-word"
                            >
                              {todo.title}
                            </Text>
                          </VStack>

                          <HStack gap={1.5} flexShrink={0}>
                            <Button
                              onClick={() => onMoveToToday(todo.id)}
                              h="38px"
                              px={3}
                              fontSize="xs"
                              fontWeight="bold"
                              borderRadius="lg"
                              bg="#FFF3E0"
                              color="#C05621"
                              _hover={{ bg: "#FEEBC8" }}
                              title="今日やることに移動"
                            >
                              <HStack gap={1}>
                                <ArrowBendUpLeft size={15} weight="bold" />
                                <Text>今日へ</Text>
                              </HStack>
                            </Button>
                            {!todo.locked && (
                              <Button
                                onClick={() => onDeleteScheduledTodo(todo)}
                                w="38px"
                                h="38px"
                                p={0}
                                borderRadius="lg"
                                bg="#EDF2F7"
                                color="#4A5568"
                                _hover={{ bg: "#FED7D7", color: "#9B2C2C" }}
                                aria-label={`${todo.title} を消す`}
                                title="消す"
                              >
                                <Trash size={18} weight="bold" />
                              </Button>
                            )}
                          </HStack>
                        </Flex>
                      );
                    })}
                  </VStack>
                </Box>
              );
            })}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
