"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeStaffAction } from "@/server/actions/staff";
import { InviteStaffDialog } from "./invite-staff-dialog";

type Member = {
  id: string;
  role: "owner" | "manager" | "kitchen" | "bar" | "cashier";
  email: string;
  name: string | null;
  createdAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  kitchen: "bg-orange-100 text-orange-700",
  bar: "bg-cyan-100 text-cyan-700",
  cashier: "bg-green-100 text-green-700",
};

export function StaffList({ members }: { members: Member[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviting, setInviting] = useState(false);

  const remove = (id: string, email: string) => {
    if (!confirm(`Remove ${email} from staff?`)) return;
    startTransition(async () => {
      await removeStaffAction(id);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => setInviting(true)}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600"
        >
          Invite staff
        </button>
      </div>

      <div className="space-y-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-lg border bg-white p-4"
          >
            <div>
              <div className="font-medium">{m.name ?? m.email}</div>
              {m.name && <div className="text-xs text-slate-500">{m.email}</div>}
              <div className="mt-1 text-xs text-slate-400">
                Joined {new Date(m.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role] ?? "bg-slate-100 text-slate-700"}`}
              >
                {m.role}
              </span>
              {m.role !== "owner" && (
                <button
                  disabled={pending}
                  onClick={() => remove(m.id, m.email)}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {inviting && (
        <InviteStaffDialog
          open
          onClose={() => setInviting(false)}
          onInvited={() => {
            setInviting(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
