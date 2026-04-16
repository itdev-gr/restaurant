"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BulkCreateTablesInput } from "@app/shared/zod/table";
import { bulkCreateTablesAction } from "@/server/actions/table";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

type FormValues = { count: number; startAt?: number; labelPrefix?: string };

export function BulkCreateDialog({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const {
    register, handleSubmit, formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(BulkCreateTablesInput) as any,
    defaultValues: { count: 10 },
  });

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const r = await bulkCreateTablesAction(values);
      if (!r.ok) { setError(r.error.message); return; }
      onCreated();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add tables">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="count" label="How many?" error={errors.count?.message}>
          <input
            {...register("count", { valueAsNumber: true })}
            type="number" className="input" min={1} max={200}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="startAt" label="Start at number" error={errors.startAt?.message}>
            <input
              {...register("startAt", {
                setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
              })}
              type="number" className="input" min={1} placeholder="auto"
            />
          </Field>
          <Field id="labelPrefix" label="Label prefix (optional)" error={errors.labelPrefix?.message}>
            <input
              {...register("labelPrefix", {
                setValueAs: (v) => (v === "" || v === null ? undefined : String(v)),
              })}
              className="input"
              placeholder="Patio"
            />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit" disabled={pending}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
