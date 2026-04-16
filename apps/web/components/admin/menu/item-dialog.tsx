"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateMenuItemInput, STATIONS, type Station } from "@app/shared/zod/menu-item";
import { createItemAction, updateItemAction, archiveItemAction } from "@/server/actions/menu-item";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

type Cat = { id: string; name: string };
type ExistingItem = {
  id: string; name: string; description: string | null; priceCents: number;
  station: Station; categoryId: string;
};

type FormValues = {
  categoryId: string;
  name: string;
  description?: string;
  priceCents: number;
  station: Station;
};

export function ItemDialog({
  open, onClose, categories, item, defaultCategoryId,
}: {
  open: boolean;
  onClose: () => void;
  categories: Cat[];
  item?: ExistingItem;
  defaultCategoryId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: FormValues = item
    ? {
        categoryId: item.categoryId, name: item.name,
        description: item.description ?? "",
        priceCents: item.priceCents, station: item.station,
      }
    : {
        categoryId: defaultCategoryId ?? categories[0]?.id ?? "",
        name: "", description: "", priceCents: 0, station: "kitchen",
      };

  const {
    register, handleSubmit, formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(CreateMenuItemInput) as any,
    defaultValues: defaults,
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    startTransition(async () => {
      const r = item
        ? await updateItemAction({ id: item.id, ...values })
        : await createItemAction(values);
      if (!r.ok) { setServerError(r.error.message); return; }
      onClose();
      router.refresh();
    });
  };

  const onArchive = () => {
    if (!item) return;
    if (!confirm("Archive this item?")) return;
    startTransition(async () => {
      await archiveItemAction(item.id);
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={item ? "Edit item" : "Add item"}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="categoryId" label="Category" error={errors.categoryId?.message}>
          <select {...register("categoryId")} className="input">
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </Field>
        <Field id="name" label="Name" error={errors.name?.message}>
          <input {...register("name")} className="input" />
        </Field>
        <Field id="description" label="Description" error={errors.description?.message}>
          <textarea {...register("description")} className="input" rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="priceCents" label="Price (cents)" error={errors.priceCents?.message}>
            <input
              {...register("priceCents", { valueAsNumber: true })}
              type="number" className="input" min={0} step={1}
            />
          </Field>
          <Field id="station" label="Station" error={errors.station?.message}>
            <select {...register("station")} className="input">
              {STATIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </Field>
        </div>
        {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
        <div className="flex items-center justify-between pt-2">
          {item ? (
            <button type="button" onClick={onArchive} disabled={pending} className="text-sm text-red-600 hover:underline">
              Archive
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit" disabled={pending}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {pending ? "Saving…" : item ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
