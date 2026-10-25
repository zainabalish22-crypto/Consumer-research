"use client";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Block, Language } from "@/lib/study/schema";
import { cx } from "@/components/ui";
import { IconButton } from "./controls";
import { BlockIcon } from "./BlockIcon";

function blockTitle(b: Block, lang: Language): string {
  if (b.name) return b.name;
  const h = "heading" in b ? b.heading : undefined;
  return h?.[lang] || h?.en || h?.ar || "";
}

function Row({
  block,
  index,
  count,
  selected,
  issues,
  lang,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
}: {
  block: Block;
  index: number;
  count: number;
  selected: boolean;
  issues: number;
  lang: Language;
  onSelect: () => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("builder.flow");
  const tt = useTranslations("builder.blockTypes");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const title = blockTitle(block, lang);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        "flex items-center gap-1 rounded-lg border bg-surface px-1.5 py-1",
        selected ? "border-accent ring-1 ring-accent" : "border-line",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("dragHandle", { n: index + 1 })}
        className="cursor-grab touch-none rounded px-1 py-2 text-muted hover:bg-paper active:cursor-grabbing"
      >
        ⠿
      </button>
      <BlockIcon type={block.type} className="ms-0.5" />
      <button type="button" onClick={onSelect} aria-current={selected} className="ms-1 flex min-w-0 flex-1 flex-col items-start py-1 text-start">
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="tabular-nums">{index + 1}</span>
          <span>{tt(block.type)}</span>
          {issues > 0 && (
            <span className="rounded-full bg-danger-soft px-1.5 text-danger" title={t("issues", { n: issues })}>
              {issues}
            </span>
          )}
        </span>
        <span className="w-full truncate text-sm" dir="auto">
          {title || <span className="text-muted">{t("untitled")}</span>}
        </span>
      </button>
      <IconButton label={t("moveUp")} disabled={index === 0} onClick={() => onMove(index - 1)}>
        ↑
      </IconButton>
      <IconButton label={t("moveDown")} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        ↓
      </IconButton>
      <IconButton label={t("duplicate")} onClick={onDuplicate}>
        ⧉
      </IconButton>
      <IconButton label={t("remove")} onClick={onRemove}>
        ✕
      </IconButton>
    </li>
  );
}

export function FlowList({
  blocks,
  selectedId,
  issuesByBlock,
  lang,
  onSelect,
  onReorder,
  onDuplicate,
  onRemove,
}: {
  blocks: Block[];
  selectedId: string | null;
  issuesByBlock: Record<string, number>;
  lang: Language;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = blocks.findIndex((b) => b.id === e.active.id);
    const to = blocks.findIndex((b) => b.id === e.over!.id);
    if (from >= 0 && to >= 0) onReorder(from, to);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-1.5">
          {blocks.map((b, i) => (
            <Row
              key={b.id}
              block={b}
              index={i}
              count={blocks.length}
              selected={b.id === selectedId}
              issues={issuesByBlock[b.id] ?? 0}
              lang={lang}
              onSelect={() => onSelect(b.id)}
              onMove={(to) => onReorder(i, to)}
              onDuplicate={() => onDuplicate(b.id)}
              onRemove={() => onRemove(b.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
