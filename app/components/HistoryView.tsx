"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Text,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { HistoryRecord, WeeklyAllowances } from "../types";
import { formatDateKey, formatWeekRange, getWeekDays } from "../utils/date";

type HistoryViewProps = {
  history: HistoryRecord[];
  weeklyAllowances: WeeklyAllowances;
};

export function HistoryView({ history, weeklyAllowances }: HistoryViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    formatDateKey(new Date())
  );

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const weekKey = weekDays[0]?.dateKey ?? "";
  const weekAllowanceEntry = weeklyAllowances[weekKey];
  const weekAllowance = weekAllowanceEntry?.amount ?? 0;
  const weekAllowancePaid = Boolean(weekAllowanceEntry?.paid);
  const weekAllowanceNote = weekAllowanceEntry?.note ?? "";

  // 日付キーごとの達成レコードをグループ化
  const recordsByDate = useMemo(() => {
    const map = new Map<string, HistoryRecord[]>();
    for (const record of history) {
      const list = map.get(record.dateKey) ?? [];
      list.push(record);
      map.set(record.dateKey, list);
    }
    return map;
  }, [history]);

  // 表示中の週の合計達成数と、グラフの高さ計算用の最大値
  const weekStats = useMemo(() => {
    let total = 0;
    let maxCount = 0;
    for (const day of weekDays) {
      const count = recordsByDate.get(day.dateKey)?.length ?? 0;
      total += count;
      if (count > maxCount) maxCount = count;
    }
    return {
      total,
      maxCount: Math.max(maxCount, 3), // 最低基準を3にして1個でもバランス良く見せる
    };
  }, [weekDays, recordsByDate]);

  // 週を切り替えたとき、選択中の日付がその週に含まれていなければ月曜（または今日）に合わせる
  const handleChangeWeek = (nextOffset: number) => {
    setWeekOffset(nextOffset);
    const nextDays = getWeekDays(nextOffset);
    const todayInWeek = nextDays.find((d) => d.isToday);
    setSelectedDateKey(todayInWeek ? todayInWeek.dateKey : nextDays[0].dateKey);
  };

  const selectedDayInfo =
    weekDays.find((d) => d.dateKey === selectedDateKey) ?? weekDays[0];
  const selectedRecords = recordsByDate.get(selectedDayInfo.dateKey) ?? [];

  return (
    <VStack gap={6} align="stretch">
      {/* 週間サマリーカード */}
      <Box
        bg="white"
        p={{ base: 4, md: 6 }}
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#CFE2FF"
        boxShadow="0 4px 12px rgba(144, 205, 244, 0.15)"
      >
        {/* 週ナビゲーション */}
        <Flex justify="space-between" align="center" mb={4} gap={2}>
          <Button
            onClick={() => handleChangeWeek(weekOffset - 1)}
            h="44px"
            px={{ base: 3, md: 4 }}
            fontSize={{ base: "sm", md: "md" }}
            fontWeight="bold"
            borderRadius="xl"
            bg="#EBF8FF"
            color="#2B6CB0"
            _hover={{ bg: "#BEE3F8" }}
          >
            ◀ 前の週
          </Button>

          <VStack gap={0} textAlign="center">
            <Text fontSize="xs" fontWeight="bold" color="#718096">
              {weekOffset === 0
                ? "今週"
                : weekOffset === -1
                ? "先週"
                : `${Math.abs(weekOffset)}週前`}
            </Text>
            <Text fontSize={{ base: "sm", md: "md" }} fontWeight="bold" color="#2D3748">
              {formatWeekRange(weekDays)}
            </Text>
          </VStack>

          <Button
            onClick={() => handleChangeWeek(weekOffset + 1)}
            disabled={weekOffset >= 0}
            h="44px"
            px={{ base: 3, md: 4 }}
            fontSize={{ base: "sm", md: "md" }}
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
            次の週 ▶
          </Button>
        </Flex>

        {/* 達成数＆おこづかいの強調サマリー */}
        <SimpleGrid columns={{ base: 1, sm: 3 }} gap={3} mb={5}>
          <Box
            bg="#FFF8F0"
            borderWidth="2px"
            borderColor="#FBD38D"
            borderRadius="xl"
            p={3.5}
            textAlign="center"
          >
            <Text fontSize="xs" fontWeight="bold" color="#9C4221">
              この1週間でできた数
            </Text>
            <Text fontSize={{ base: "2xl", md: "2xl" }} fontWeight="bold" color="#DD6B20">
              {weekStats.total}
              <Text as="span" fontSize="sm" ml={1}>
                個
              </Text>
            </Text>
          </Box>

          <Box
            bg="#F0FFF4"
            borderWidth="2px"
            borderColor="#9AE6B4"
            borderRadius="xl"
            p={3.5}
            textAlign="center"
          >
            <Text fontSize="xs" fontWeight="bold" color="#276749">
              この1週間のおこづかい
            </Text>
            <Text fontSize={{ base: "2xl", md: "2xl" }} fontWeight="bold" color="#2F855A">
              {weekAllowance.toLocaleString()}
              <Text as="span" fontSize="sm" ml={1}>
                円
              </Text>
            </Text>
            {weekAllowancePaid && (
              <Badge
                mt={1}
                bg="#48BB78"
                color="white"
                px={2}
                py={0.5}
                borderRadius="full"
                fontSize="10px"
                fontWeight="bold"
              >
                わたしたよ！
              </Badge>
            )}
          </Box>

          <Box
            bg="#EBF8FF"
            borderWidth="2px"
            borderColor="#BEE3F8"
            borderRadius="xl"
            p={3.5}
            textAlign="center"
          >
            <Text fontSize="xs" fontWeight="bold" color="#2B6CB0">
              これまで全部でできた数
            </Text>
            <Text fontSize={{ base: "2xl", md: "2xl" }} fontWeight="bold" color="#3182CE">
              {history.length}
              <Text as="span" fontSize="sm" ml={1}>
                個
              </Text>
            </Text>
          </Box>
        </SimpleGrid>

        {weekAllowanceNote && (
          <Box
            bg="#FFF8F0"
            borderWidth="1px"
            borderColor="#FBD38D"
            borderRadius="xl"
            p={3.5}
            mb={5}
          >
            <Text fontSize="xs" fontWeight="bold" color="#C05621" mb={0.5}>
              おうちの人からのひと言メモ
            </Text>
            <Text fontSize="sm" color="#2D3748" fontWeight="medium" wordBreak="break-word">
              {weekAllowanceNote}
            </Text>
          </Box>
        )}

        {/* 日毎の達成バーグラフ（7日間） */}
        <Text fontSize="xs" color="#718096" mb={2} textAlign="center">
          日にちをタップすると、その日にできたことが見られるよ
        </Text>
        <SimpleGrid columns={7} gap={{ base: 1.5, md: 3 }}>
          {weekDays.map((day) => {
            const count = recordsByDate.get(day.dateKey)?.length ?? 0;
            const isSelected = day.dateKey === selectedDayInfo.dateKey;
            const barHeightPercent =
              count === 0 ? 0 : Math.max(18, Math.round((count / weekStats.maxCount) * 100));

            return (
              <Box
                key={day.dateKey}
                asChild
                p={{ base: 1.5, md: 2 }}
                borderRadius="xl"
                borderWidth="2px"
                borderColor={
                  isSelected ? "#ED8936" : day.isToday ? "#90CDF4" : "#E2E8F0"
                }
                bg={isSelected ? "#FFF8F0" : day.isToday ? "#F0F8FF" : "#F8FAFC"}
                cursor="pointer"
                transition="all 0.15s"
                _hover={{ borderColor: "#63B3ED" }}
                display="flex"
                flexDirection="column"
                alignItems="center"
              >
                <button type="button" onClick={() => setSelectedDateKey(day.dateKey)}>
                  {/* 曜日 */}
                  <Text
                    fontSize={{ base: "xs", md: "sm" }}
                    fontWeight="bold"
                    color={
                      day.weekdayLabel === "日"
                        ? "#E53E3E"
                        : day.weekdayLabel === "土"
                        ? "#3182CE"
                        : "#4A5568"
                    }
                  >
                    {day.weekdayLabel}
                  </Text>

                  {/* 日付 */}
                  <Text fontSize="10px" color="#718096" mb={2}>
                    {day.monthDay}
                  </Text>

                  {/* 棒グラフエリア */}
                  <Flex
                    w="full"
                    h="88px"
                    bg="#EDF2F7"
                    borderRadius="lg"
                    align="flex-end"
                    justify="center"
                    p="3px"
                    overflow="hidden"
                  >
                    {count > 0 && (
                      <Box
                        w="full"
                        h={`${barHeightPercent}%`}
                        bg={isSelected ? "#F6AD55" : "#63B3ED"}
                        borderRadius="md"
                        transition="height 0.2s ease"
                      />
                    )}
                  </Flex>

                  {/* 達成数 */}
                  <Text
                    mt={1.5}
                    fontSize={{ base: "xs", md: "sm" }}
                    fontWeight="bold"
                    color={count > 0 ? "#DD6B20" : "#A0AEC0"}
                  >
                    {count}個
                  </Text>
                </button>
              </Box>
            );
          })}
        </SimpleGrid>
      </Box>

      {/* 選択した日の詳細リスト */}
      <Box
        bg="white"
        p={{ base: 4, md: 6 }}
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#CFE2FF"
        boxShadow="0 4px 12px rgba(144, 205, 244, 0.15)"
      >
        <Flex justify="space-between" align="center" mb={4} gap={2} flexWrap="wrap">
          <HStack gap={2}>
            <Heading as="h2" fontSize={{ base: "lg", md: "xl" }} color="#2D3748">
              {selectedDayInfo.monthDay}（{selectedDayInfo.weekdayLabel}）にできたこと
            </Heading>
            {selectedDayInfo.isToday && (
              <Badge
                bg="#FFF3E0"
                color="#C05621"
                px={2.5}
                py={0.5}
                borderRadius="full"
                fontSize="xs"
                fontWeight="bold"
              >
                今日
              </Badge>
            )}
          </HStack>

          <Badge
            bg="#EBF8FF"
            color="#2B6CB0"
            px={3}
            py={1}
            borderRadius="full"
            fontSize="sm"
            fontWeight="bold"
          >
            {selectedRecords.length}個 できた！
          </Badge>
        </Flex>

        {selectedRecords.length === 0 ? (
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
              この日にできたことの記録はまだないよ
            </Text>
          </Box>
        ) : (
          <VStack gap={2.5} align="stretch">
            {selectedRecords.map((record) => {
              const time = new Date(record.completedAt);
              const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(
                time.getMinutes()
              ).padStart(2, "0")}`;

              return (
                <Flex
                  key={`${record.id}-${record.completedAt}`}
                  align="center"
                  justify="space-between"
                  gap={3}
                  p={3.5}
                  bg="#F8FBFF"
                  borderRadius="xl"
                  borderWidth="1px"
                  borderColor="#BEE3F8"
                >
                  <HStack gap={3} flex={1} flexWrap="wrap">
                    <Badge
                      bg="#F6AD55"
                      color="white"
                      borderRadius="full"
                      px={2}
                      py={0.5}
                      fontSize="xs"
                      fontWeight="bold"
                      flexShrink={0}
                    >
                      できた！
                    </Badge>
                    {record.parentChecked && (
                      <Badge
                        bg="#48BB78"
                        color="white"
                        borderRadius="full"
                        px={2}
                        py={0.5}
                        fontSize="xs"
                        fontWeight="bold"
                        flexShrink={0}
                      >
                        おうちの人OK!
                      </Badge>
                    )}
                    <Text
                      fontSize={{ base: "md", md: "lg" }}
                      fontWeight="bold"
                      color="#2D3748"
                      wordBreak="break-word"
                    >
                      {record.title}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="#718096" flexShrink={0}>
                    {timeStr}
                  </Text>
                </Flex>
              );
            })}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
