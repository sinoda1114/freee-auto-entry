"use client";

import { Button } from "@heroui/react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  reconcileRecurringInvoicesAction,
  type ReconcileRecurringState,
} from "@/app/recurring-invoices/actions";

const initialState: ReconcileRecurringState = { status: "idle" };

export function ReconcileInvoicesButton({
  companyId,
  label = "freeeと突合（差分を埋める）",
}: {
  companyId: string;
  label?: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    reconcileRecurringInvoicesAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col items-stretch gap-1">
      <input type="hidden" name="companyId" value={companyId} />
      <Button
        type="submit"
        variant="bordered"
        size="sm"
        isLoading={isPending}
        className="font-semibold"
      >
        {label}
      </Button>
      {state.status === "success" ? (
        <p className="max-w-xs text-xs text-[var(--freee-text-muted)]">
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="max-w-xs text-xs text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
