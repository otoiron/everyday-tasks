"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

export function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list;
  const result = [...list];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * マウス・タッチ両対応のドラッグ＆ドロップ並び替えフック（指に吸い付く追従アニメーション対応）
 */
export function useDragReorder(onReorder: (fromIndex: number, toIndex: number) => void) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingIndexRef = useRef<number | null>(null);
  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const prevTopRef = useRef<number | null>(null);
  const onReorderRef = useRef(onReorder);

  onReorderRef.current = onReorder;

  const startDrag = useCallback((index: number, e: React.PointerEvent) => {
    e.preventDefault();
    draggingIndexRef.current = index;
    startYRef.current = e.clientY;
    currentYRef.current = e.clientY;
    prevTopRef.current = null;
    setDragOffsetY(0);
    setDraggingIndex(index);
  }, []);

  // 配列入れ替え後に DOM の位置が変わった分を補正し、掴んでいる要素が指の位置からズレないようにする
  useLayoutEffect(() => {
    if (draggingIndex === null || prevTopRef.current === null) return;
    const container = containerRef.current;
    if (!container) return;

    const currentEl = container.children[draggingIndex] as HTMLElement | undefined;
    if (!currentEl) return;

    // 現在の transform を一時的に外した状態の本来のレイアウト位置を比較する
    const currentRectTop = currentEl.getBoundingClientRect().top - (currentYRef.current - startYRef.current);
    const layoutShift = currentRectTop - prevTopRef.current;

    if (layoutShift !== 0) {
      startYRef.current += layoutShift;
      setDragOffsetY(currentYRef.current - startYRef.current);
    }
    prevTopRef.current = null;
  }, [draggingIndex]);

  useEffect(() => {
    if (draggingIndex === null) return;

    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      const currentIdx = draggingIndexRef.current;
      if (!container || currentIdx === null) return;

      currentYRef.current = e.clientY;
      const offsetY = e.clientY - startYRef.current;
      setDragOffsetY(offsetY);

      const children = Array.from(container.children) as HTMLElement[];
      const currentEl = children[currentIdx];
      if (!currentEl) return;

      // 掴んでいる要素の現在の画面上の中心位置
      const currentRect = currentEl.getBoundingClientRect();
      const draggedCenterY = currentRect.top + currentRect.height / 2;

      for (let i = 0; i < children.length; i++) {
        if (i === currentIdx) continue;
        const targetRect = children[i].getBoundingClientRect();
        const targetMidY = targetRect.top + targetRect.height / 2;

        if (currentIdx < i && draggedCenterY > targetMidY) {
          // 入れ替え前の「本来のレイアウト上の top」を記録
          prevTopRef.current = currentRect.top - offsetY;
          onReorderRef.current(currentIdx, i);
          draggingIndexRef.current = i;
          setDraggingIndex(i);
          break;
        }
        if (currentIdx > i && draggedCenterY < targetMidY) {
          prevTopRef.current = currentRect.top - offsetY;
          onReorderRef.current(currentIdx, i);
          draggingIndexRef.current = i;
          setDraggingIndex(i);
          break;
        }
      }
    };

    const handlePointerUp = () => {
      draggingIndexRef.current = null;
      prevTopRef.current = null;
      setDraggingIndex(null);
      setDragOffsetY(0);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [draggingIndex]);

  const getItemStyle = useCallback(
    (index: number): React.CSSProperties => {
      if (draggingIndex === index) {
        return {
          transform: `translateY(${dragOffsetY}px) scale(1.02)`,
          zIndex: 20,
          position: "relative",
          transition: "none",
        };
      }
      return {
        transition: "transform 0.15s ease",
      };
    },
    [draggingIndex, dragOffsetY]
  );

  return {
    containerRef,
    draggingIndex,
    startDrag,
    getItemStyle,
  };
}
