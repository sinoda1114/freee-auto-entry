"use client";

import { Button } from "@heroui/react";
import { useActionState, useState } from "react";
import type {
  RecurringInvoiceTemplate,
  RecurringInvoiceTemplatePrefill,
} from "@/lib/db/recurring-invoices";
import type { Partner } from "@/lib/freee/accounting";
import type { InvoiceDocumentTemplate } from "@/lib/freee/invoice";
import { saveTemplateAction, type TemplateActionState } from "./actions";

const initialState: TemplateActionState = { status: "idle" };

interface EditableLine {
  key: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

function emptyLine(): EditableLine {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    taxRate: 10,
  };
}

export function TemplateForm({
  companyId,
  partners,
  invoiceTemplates,
  template,
  prefill,
  sourceLabel,
}: {
  companyId: string;
  partners: Partner[];
  invoiceTemplates: InvoiceDocumentTemplate[];
  template?: RecurringInvoiceTemplate;
  prefill?: RecurringInvoiceTemplatePrefill;
  sourceLabel?: string;
}) {
  const values = template ?? prefill;
  const [state, formAction, isPending] = useActionState(
    saveTemplateAction,
    initialState,
  );
  const [lines, setLines] = useState<EditableLine[]>(
    (template?.lines ?? prefill?.lines)?.map((line) => ({
      ...line,
      key: crypto.randomUUID(),
    })) ?? [emptyLine()],
  );

  const selectedPartner = values
    ? JSON.stringify({ id: values.partnerId, name: values.partnerName })
    : "";

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="companyId" value={companyId} />
      {template?.id && (
        <input type="hidden" name="templateId" value={template.id} />
      )}
      {sourceLabel ? (
        <p className="rounded-[var(--radius-panel)] border border-[var(--freee-border)] bg-[color-mix(in_srgb,var(--freee-blue)_8%,transparent)] px-3 py-2 text-xs text-[var(--freee-text)]">
          {sourceLabel}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-label">
          管理名
          <input
            name="name"
            defaultValue={values?.name}
            required
            className="form-input"
          />
        </label>
        <label className="form-label">
          取引先
          <select
            name="partner"
            defaultValue={selectedPartner}
            required
            className="form-input"
          >
            <option value="">選択してください</option>
            {partners.map((partner) => {
              const value = JSON.stringify({
                id: partner.id,
                name: partner.name,
              });
              return (
                <option key={partner.id} value={value}>
                  {partner.name}
                </option>
              );
            })}
          </select>
        </label>
        <label className="form-label md:col-span-2">
          件名
          <input
            name="subject"
            defaultValue={values?.subject}
            className="form-input"
          />
        </label>
        <label className="form-label">
          送付先 TO
          <input
            type="email"
            name="emailTo"
            defaultValue={values?.emailTo}
            className="form-input"
          />
        </label>
        <label className="form-label">
          送付先 CC
          <input
            name="emailCc"
            defaultValue={values?.emailCc}
            placeholder="複数はカンマ区切り"
            className="form-input"
          />
        </label>
        <label className="form-label">
          送付方法
          <select
            name="sendingMethod"
            defaultValue={values?.sendingMethod ?? "email"}
            className="form-input"
          >
            <option value="email">メール</option>
            <option value="posting">郵送</option>
            <option value="email_and_posting">メール＋郵送</option>
          </select>
        </label>
        <label className="form-label md:col-span-2">
          帳票テンプレート（PDFのレイアウト）
          <select
            name="invoiceTemplateId"
            defaultValue={
              values?.invoiceTemplateId ? String(values.invoiceTemplateId) : ""
            }
            className="form-input"
          >
            <option value="">事業所の既定（freee 設定）</option>
            {invoiceTemplates.map((documentTemplate) => (
              <option key={documentTemplate.id} value={documentTemplate.id}>
                {documentTemplate.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs leading-relaxed text-[var(--freee-text-muted)] md:col-span-2">
          請求書PDFの見た目用です。送付画面の「メールテンプレート」とは別設定で、API
          からはメールテンプレートを指定できません。
        </p>
      </div>

      <fieldset className="grid gap-3">
        <legend className="form-section-title">請求明細</legend>
        {lines.map((line, index) => (
          <div key={line.key} className="form-line-row form-line-row--wide">
            <label className="form-label text-xs">
              摘要
              <input
                name="lineDescription"
                value={line.description}
                required
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, description: event.target.value }
                        : item,
                    ),
                  )
                }
                className="form-input"
              />
            </label>
            <label className="form-label text-xs">
              数量
              <input
                type="number"
                name="lineQuantity"
                value={line.quantity}
                min="0.001"
                step="0.001"
                required
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, quantity: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="form-input"
              />
            </label>
            <label className="form-label text-xs">
              単価
              <input
                type="number"
                name="lineUnitPrice"
                value={line.unitPrice}
                min="0"
                required
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, unitPrice: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="form-input"
              />
            </label>
            <label className="form-label text-xs">
              税率
              <select
                name="lineTaxRate"
                value={line.taxRate}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, taxRate: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="form-input"
              >
                <option value="10">10%</option>
                <option value="8">8%</option>
                <option value="0">0%</option>
              </select>
            </label>
            <Button
              type="button"
              variant="bordered"
              size="sm"
              isDisabled={lines.length === 1}
              onPress={() =>
                setLines((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              className="self-end"
            >
              削除
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="bordered"
          size="sm"
          onPress={() => setLines((current) => [...current, emptyLine()])}
          className="w-fit"
        >
          ＋ 明細を追加
        </Button>
      </fieldset>

      <Button type="submit" color="primary" isLoading={isPending}>
        {template ? "変更を保存" : "定型請求を登録"}
      </Button>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "success"
              ? "text-sm text-success"
              : "text-sm text-danger"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
