export function PageLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl animate-pulse px-4 py-5 sm:px-5">
      <div className="h-4 w-32 rounded bg-[var(--freee-border)]" />
      <div className="mt-4 h-6 w-48 rounded bg-[var(--freee-border)]" />
      <div className="mt-2 h-4 w-full max-w-xl rounded bg-[var(--freee-border)]" />
      <div className="panel mt-5 space-y-3 px-4 py-4">
        <div className="h-8 rounded bg-[var(--freee-border)]" />
        <div className="h-8 rounded bg-[var(--freee-border)]" />
        <div className="h-24 rounded bg-[var(--freee-border)]" />
      </div>
    </div>
  );
}
