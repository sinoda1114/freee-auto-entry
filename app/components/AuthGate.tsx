"use client";

import { Button } from "@heroui/react";
import NextLink from "next/link";
import { buildLoginHref } from "@/lib/auth/return-to";

interface AuthGateProps {
  title: string;
  description?: string;
  /** ログイン後に戻す同一オリジン相対パス */
  returnTo?: string;
}

export function AuthGate({
  title,
  description = "freeeとの連携が切れています。再度ログインしてください。",
  returnTo,
}: AuthGateProps) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
      <div className="panel w-full px-4 py-5 text-center shadow-sm">
        <h1 className="page-title">{title}</h1>
        <p className="mt-2 text-xs text-[var(--freee-text-muted)]">{description}</p>
        <Button
          as={NextLink}
          href={buildLoginHref(returnTo)}
          color="primary"
          size="sm"
          className="mt-4 font-semibold"
        >
          freeeと連携する
        </Button>
      </div>
    </section>
  );
}
