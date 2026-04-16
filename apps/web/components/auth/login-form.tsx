"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginInput } from "@app/shared/zod/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Field } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") ?? "/dashboard";
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginInput) });

  const onSubmit = (values: LoginInput) => {
    setServerError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        setServerError("Invalid email or password.");
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <Field id="email" label="Email" error={errors.email?.message}>
        <input {...register("email")} type="email" className="input" autoComplete="email" />
      </Field>
      <Field id="password" label="Password" error={errors.password?.message}>
        <input
          {...register("password")}
          type="password"
          className="input"
          autoComplete="current-password"
        />
      </Field>
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
        {pending ? "Signing in…" : "Log in"}
      </button>
      <p className="text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="text-brand-600 underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
