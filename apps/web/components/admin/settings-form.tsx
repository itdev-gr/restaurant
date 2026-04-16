"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateRestaurantInput, CURRENCIES } from "@app/shared/zod/restaurant";
import { updateRestaurantAction } from "@/server/actions/restaurant-settings";
import { Field } from "@/components/ui/field";

type FormValues = {
  name: string;
  address?: string;
  currency: "EUR" | "USD" | "GBP";
  taxRatePct: number;
  serviceChargePct: number;
};

type Props = {
  current: {
    name: string;
    address: string | null;
    currency: string;
    taxRate: string;
    serviceChargePct: string;
  };
};

export function SettingsForm({ current }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(UpdateRestaurantInput) as any,
    defaultValues: {
      name: current.name,
      address: current.address ?? "",
      currency: current.currency as "EUR" | "USD" | "GBP",
      taxRatePct: Number(current.taxRate),
      serviceChargePct: Number(current.serviceChargePct),
    },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    setSuccess(false);
    startTransition(async () => {
      const r = await updateRestaurantAction(values);
      if (!r.ok) {
        setServerError(r.error.message);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <Field id="name" label="Restaurant name" error={errors.name?.message}>
        <input {...register("name")} className="input" />
      </Field>
      <Field
        id="address"
        label="Address (optional)"
        error={errors.address?.message}
      >
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
        <Field
          id="taxRatePct"
          label="Tax %"
          error={errors.taxRatePct?.message}
        >
          <input
            {...register("taxRatePct", { valueAsNumber: true })}
            type="number"
            step="0.01"
            className="input"
          />
        </Field>
        <Field
          id="serviceChargePct"
          label="Service %"
          error={errors.serviceChargePct?.message}
        >
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
      {success && <p className="text-sm text-green-600">Settings saved!</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Saving\u2026" : "Save settings"}
      </button>
    </form>
  );
}
