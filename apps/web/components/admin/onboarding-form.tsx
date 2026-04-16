"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CreateRestaurantInput, CURRENCIES } from "@app/shared/zod/restaurant";
import { createRestaurantAction } from "@/server/actions/restaurant";
import { Field } from "@/components/ui/field";

// Use zod INPUT type — schema has `.default()` on several fields, so output
// differs from input. react-hook-form's resolver operates on the input shape.
type FormValues = z.input<typeof CreateRestaurantInput>;

export function OnboardingForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateRestaurantInput) as never,
    defaultValues: { currency: "EUR", taxRatePct: 0, serviceChargePct: 0 },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createRestaurantAction(values);
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1 className="text-2xl font-semibold">Create your restaurant</h1>
      <p className="text-sm text-slate-600">You can edit any of this later in Settings.</p>

      <Field id="name" label="Restaurant name" error={errors.name?.message}>
        <input {...register("name")} className="input" />
      </Field>

      <Field id="address" label="Address (optional)" error={errors.address?.message}>
        <input {...register("address")} className="input" />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field id="currency" label="Currency" error={errors.currency?.message}>
          <select {...register("currency")} className="input">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field id="taxRatePct" label="Tax %" error={errors.taxRatePct?.message}>
          <input
            {...register("taxRatePct", { valueAsNumber: true })}
            type="number"
            step="0.01"
            className="input"
          />
        </Field>
        <Field id="serviceChargePct" label="Service %" error={errors.serviceChargePct?.message}>
          <input
            {...register("serviceChargePct", { valueAsNumber: true })}
            type="number"
            step="0.01"
            className="input"
          />
        </Field>
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-red-600">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create restaurant"}
      </button>
    </form>
  );
}
