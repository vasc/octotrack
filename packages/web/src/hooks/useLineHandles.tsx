import type { ReactNode } from "react";
import { LineHandle } from "../components/home/LineHandle.tsx";
import { useDragOrder } from "./useDragOrder.ts";
import type { HomeActions } from "./useHome.ts";

export type LineSection = "working" | "up_next";

/**
 * Each line's handle, the one way to reorder it: dragged onto another line, or opened for its moves; and where another
 * line can be dropped. Built here so home's sections only place them.
 */
export function useLineHandles(h: HomeActions) {
  const dragFor = useDragOrder(h.dropOn);
  const drop = (ref: string, section: LineSection) => dragFor(ref, section).target;
  const handle = (
    title: string,
    ref: string,
    index: number,
    count: number,
    section: LineSection,
    /** Its number in the order, which is the handle's face. */
    number: number = index + 1,
  ): ReactNode => (
    <LineHandle
      title={title}
      number={number}
      canMoveUp={index > 0}
      canMoveDown={index < count - 1}
      canQueue={section === "working"}
      drag={dragFor(ref, section).handle}
      onMove={(direction) => h.reorder(ref, direction)}
    />
  );
  return { handle, drop };
}
