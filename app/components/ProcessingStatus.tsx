"use client";

import { Spinner } from "@heroui/react";

export function ProcessingStatus({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 text-sm text-[var(--freee-text-muted)] ${className}`}
    >
      <Spinner size="sm" color="primary" />
      <span>{label}</span>
    </div>
  );
}
