"use client";
import { useState } from "react";
import { Button, Select } from "@/components/ui";
import { IconButton, moveItem } from "@/components/builder/controls";

export interface IdListLabels {
  none: string;
  missing: string;
  moveUp: string;
  remove: string;
  choose: string;
  add: string;
}

/** An ordered list of library ids with add / remove / move up. */
export function IdList({
  label,
  hint,
  ids,
  options,
  onChange,
  labels,
}: {
  label: string;
  hint?: string;
  ids: string[];
  options: { id: string; label: string }[];
  onChange: (ids: string[]) => void;
  labels: IdListLabels;
}) {
  const [adding, setAdding] = useState("");
  const byId = new Map(options.map((o) => [o.id, o.label]));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {ids.length === 0 && <p className="text-xs text-muted">{labels.none}</p>}
      {ids.map((id, i) => (
        <div key={id} className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-sm">
          <span className="flex-1 truncate" dir="auto">
            {byId.get(id) ?? <span className="text-danger">{labels.missing}</span>}
          </span>
          <IconButton label={labels.moveUp} disabled={i === 0} onClick={() => onChange(moveItem(ids, i, i - 1))}>
            ↑
          </IconButton>
          <IconButton label={labels.remove} onClick={() => onChange(ids.filter((x) => x !== id))}>
            ✕
          </IconButton>
        </div>
      ))}
      <div className="flex gap-2">
        <Select aria-label={label} value={adding} onChange={(e) => setAdding(e.target.value)}>
          <option value="">{labels.choose}</option>
          {options
            .filter((o) => !ids.includes(o.id))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
        </Select>
        <Button
          variant="secondary"
          size="sm"
          disabled={!adding}
          onClick={() => {
            onChange([...ids, adding]);
            setAdding("");
          }}
        >
          {labels.add}
        </Button>
      </div>
    </div>
  );
}
