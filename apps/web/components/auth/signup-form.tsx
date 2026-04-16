"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignupInput } from "@app/shared/zod/auth";
import { signupAction } from "@/server/actions/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(SignupInput) });

  const onSubmit = (values: SignupInput) => {
    setServerError(null);
    startTransition(async () => {
      // Create the user server-side (admin + mirror).
      const result = await signupAction(values);
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      // Now sign in client-side so the cookie session lands.
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        setServerError("Account created but sign-in failed. Try logging in.");
        return;
      }
      router.replace("/onboarding");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <Field label="Name" error={errors.name?.message}>
        <input {...register("name")} className="input" autoComplete="name" />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <input {...register("email")} type="email" className="input" autoComplete="email" />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <input
          {...register("password")}
          type="password"
          className="input"
          autoComplete="new-password"
        />
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-600">
        Already have an account? <a href="/login" className="text-brand-600 underline">Log in</a>
      </p>
    </form>
  );
}

function Field({
  label, error, children,
}: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
