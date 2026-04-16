"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InviteStaffInput, STAFF_ROLES } from "@app/shared/zod/staff";
import { inviteStaffAction } from "@/server/actions/staff";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

type FormValues = { email: string; name?: string; role: "manager" | "kitchen" | "bar" | "cashier" };

export function InviteStaffDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(InviteStaffInput) as any,
    defaultValues: { role: "kitchen" },
  });

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const r = await inviteStaffAction(values);
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      onInvited();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Invite staff member">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="staff-email" label="Email" error={errors.email?.message}>
          <input {...register("email")} type="email" className="input" autoComplete="email" />
        </Field>
        <Field id="staff-name" label="Name (optional)" error={errors.name?.message}>
          <input {...register("name")} className="input" />
        </Field>
        <Field id="staff-role" label="Role" error={errors.role?.message}>
          <select {...register("role")} className="input">
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? "Inviting\u2026" : "Invite"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
