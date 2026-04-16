"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TableCard } from "./table-card";
import { BulkCreateDialog } from "./bulk-create-dialog";
import { generateQrPdfAction } from "@/server/actions/qr";

type Table = { id: string; number: number; label: string | null; token: string };

export function TableGrid({ tables }: { tables: Table[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const downloadPdf = () => {
    setError(null);
    startTransition(async () => {
      const r = await generateQrPdfAction();
      if (!r.ok) { setError(r.error.message); return; }
      const bytes = Uint8Array.from(atob(r.data.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tables</h1>
        <div className="flex gap-2">
          <button
            onClick={downloadPdf}
            disabled={pending || tables.length === 0}
            className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? "Generating…" : "Print QR codes"}
          </button>
          <button
            onClick={() => setCreating(true)}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600"
          >
            Add tables
          </button>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {tables.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">
          No tables yet. Click &quot;Add tables&quot; to create them in bulk.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {tables.map((t) => (
            <TableCard key={t.id} table={t} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}
      {creating && (
        <BulkCreateDialog
          open
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
