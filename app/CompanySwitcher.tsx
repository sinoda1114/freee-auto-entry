"use client";

import { Button, Select, SelectItem, Tooltip } from "@heroui/react";
import { useState, useTransition } from "react";
import { switchCompanyAction } from "./company-actions";

export interface CompanyOption {
  companyId: string;
  companyName: string;
}

interface CompanySwitcherProps {
  companies: CompanyOption[];
  activeCompanyId?: string;
}

export function CompanySwitcher({
  companies,
  activeCompanyId,
}: CompanySwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingCompanyId, setPendingCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedCompanyId = pendingCompanyId ?? activeCompanyId ?? "";

  return (
    <div className="relative flex items-center gap-1">
      <Select
        aria-label="事業所を切り替え"
        size="sm"
        variant="bordered"
        classNames={{
          base: "w-[9.5rem] sm:w-[11rem]",
          trigger:
            "h-8 min-h-8 border-[var(--freee-border)] bg-[var(--freee-surface)] px-2",
          value: "truncate text-xs text-[var(--freee-text)]",
          selectorIcon: "text-[var(--freee-text-muted)]",
        }}
        selectedKeys={selectedCompanyId ? [selectedCompanyId] : []}
        isDisabled={isPending || companies.length <= 1}
        onSelectionChange={(keys) => {
          const companyId = Array.from(keys)[0]?.toString();
          if (!companyId || companyId === selectedCompanyId) {
            return;
          }
          setPendingCompanyId(companyId);
          setError(null);
          startTransition(async () => {
            try {
              const result = await switchCompanyAction(companyId);
              if (result.status !== "switched") {
                setPendingCompanyId(null);
                setError(
                  "事業所を切り替えられませんでした。再連携してください。",
                );
              } else {
                setPendingCompanyId(null);
              }
            } catch {
              setPendingCompanyId(null);
              setError("事業所を切り替えられませんでした。再試行してください。");
            }
          });
        }}
      >
        {companies.map((company) => (
          <SelectItem key={company.companyId} textValue={company.companyName}>
            {company.companyName}
          </SelectItem>
        ))}
      </Select>
      <Tooltip content="別の事業所を追加" size="sm">
        <Button
          as="a"
          href="/api/auth/login"
          isIconOnly
          size="sm"
          variant="light"
          aria-label="別の事業所を追加"
          className="size-8 min-w-8 text-base text-[var(--freee-text-muted)]"
        >
          +
        </Button>
      </Tooltip>
      {error ? (
        <p
          role="alert"
          className="absolute top-full right-0 z-10 mt-1 max-w-[14rem] rounded-md border border-danger-200 bg-danger-50 px-2 py-1 text-[10px] leading-snug text-danger shadow-sm"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
