interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-xl">
        {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
        <h1 className={`page-title ${eyebrow ? "mt-0.5" : ""}`}>{title}</h1>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-[var(--freee-text-muted)] sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-1.5">{actions}</div>
      ) : null}
    </div>
  );
}
