"use client";

import { Button } from "@heroui/react";
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
      <Button type="submit" variant="bordered" size="sm" isLoading={pending}>
        {active ? "停止" : "再開"}
      </Button>
      {state.status === "error" && (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      )}
    </form>
  );
}
