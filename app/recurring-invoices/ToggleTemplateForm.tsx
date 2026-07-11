"use client";

import { useActionState } from "react";
import { toggleTemplateAction, type TemplateActionState } from "./actions";

const initialState: TemplateActionState = { status: "idle" };

export function ToggleTemplateForm({
  companyId,
  templateId,
  active,
}: {
  companyId: string;
  templateId: string;
  active: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    toggleTemplateAction,
    initialState,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="active" value={String(!active)} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50 dark:border-slate-700"
      >
        {pending ? "変更中..." : active ? "停止" : "再開"}
      </button>
      {state.status === "error" && (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      )}
    </form>
  );
}
