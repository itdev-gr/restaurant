"use client";

import { useTransition } from "react";
import { archiveTableAction, renameTableAction } from "@/server/actions/table";

type Table = { id: string; number: number; label: string | null; token: string };

export function TableCard({ table, onChanged }: { table: Table; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();

  const archive = () => {
    if (!confirm(`Archive table ${table.number}?`)) return;
    startTransition(async () => {
      await archiveTableAction(table.id);
      onChanged();
    });
  };

  const rename = () => {
    const label = prompt(`Label for table ${table.number}`, table.label ?? "") ?? null;
    if (label === null) return;
    startTransition(async () => {
      await renameTableAction({ id: table.id, label: label.trim() || null });
      onChanged();
    });
  };

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-4 text-center shadow-sm">
      <div className="text-xs text-slate-500">Table</div>
      <div className="text-2xl font-semibold">{table.number}</div>
      <div className="w-full truncate text-xs text-slate-500" title={table.label ?? ""}>
        {table.label ?? " "}
      </div>
      <code className="block truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500" title={table.token}>
        {table.token.slice(0, 8)}…
      </code>
      <div className="mt-2 flex gap-2">
        <button onClick={rename} disabled={pending} className="text-xs text-brand-600 hover:underline">
          Rename
        </button>
        <button onClick={archive} disabled={pending} className="text-xs text-red-600 hover:underline">
          Archive
        </button>
      </div>
    </div>
  );
}
