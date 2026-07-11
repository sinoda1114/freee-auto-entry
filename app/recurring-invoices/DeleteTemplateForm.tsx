"use client";

import { Button } from "@heroui/react";
import { useActionState } from "react";
import { deleteTemplateAction, type TemplateActionState } from "./actions";

const initialState: TemplateActionState = { status: "idle" };

export function DeleteTemplateForm({
  companyId,
  templateId,
  templateName,
}: {
  companyId: string;
  templateId: string;
  templateName: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteTemplateAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `「${templateName}」を削除します。作成履歴も消えます。よろしいですか？`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="templateId" value={templateId} />
      <Button
        type="submit"
        variant="bordered"
        size="sm"
        color="danger"
        isLoading={pending}
      >
        削除
      </Button>
      {state.status === "error" && (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      )}
    </form>
  );
}
