"use client";

import { useEffect, useState, useTransition } from "react";
import { switchCompanyAction } from "./company-actions";

export interface CompanyOption {
  companyId: string;
  companyName: string;
}

interface CompanySwitcherProps {
  companies: CompanyOption[];
  activeCompanyId?: string;
}

export function CompanySwitcher({ companies, activeCompanyId }: CompanySwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    activeCompanyId ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCompanyId(activeCompanyId ?? "");
  }, [activeCompanyId]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <label
          htmlFor="company-switcher"
          className="text-sm text-zinc-500 dark:text-zinc-400"
        >
          事業所を切り替え:
        </label>
        <select
          id="company-switcher"
          value={selectedCompanyId}
          disabled={isPending || companies.length <= 1}
          onChange={(event) => {
            const companyId = event.target.value;
            setSelectedCompanyId(companyId);
            setError(null);
            startTransition(async () => {
              try {
                const result = await switchCompanyAction(companyId);
                if (result.status !== "switched") {
                  setSelectedCompanyId(activeCompanyId ?? "");
                  setError("事業所を切り替えられませんでした。再連携してください。");
                }
              } catch {
                setSelectedCompanyId(activeCompanyId ?? "");
                setError("事業所を切り替えられませんでした。再試行してください。");
              }
            });
          }}
          className="rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
        >
          {companies.map((company) => (
            <option key={company.companyId} value={company.companyId}>
              {company.companyName}
            </option>
          ))}
        </select>
        <a
          href="/api/auth/login"
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          + 別の事業所を追加
        </a>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
