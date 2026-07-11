export function HeaderFallback() {
  return (
    <header className="min-h-12 border-b border-[var(--freee-border)] bg-[var(--freee-surface)]">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-4 sm:px-5">
        <div className="h-4 w-40 animate-pulse rounded bg-[var(--freee-border)]" />
        <div className="hidden flex-1 justify-center gap-2 md:flex">
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--freee-border)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--freee-border)]" />
          <div className="h-4 w-12 animate-pulse rounded bg-[var(--freee-border)]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="size-8 animate-pulse rounded bg-[var(--freee-border)]" />
          <div className="h-8 w-28 animate-pulse rounded bg-[var(--freee-border)]" />
        </div>
      </div>
    </header>
  );
}
