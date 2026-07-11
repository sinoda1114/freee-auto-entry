interface PageShellProps {
  children: React.ReactNode;
  width?: "md" | "lg" | "xl";
}

const widthClass = {
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
} as const;

export function PageShell({ children, width = "xl" }: PageShellProps) {
  return (
    <div
      className={`mx-auto w-full px-4 py-5 sm:px-5 lg:py-6 ${widthClass[width]}`}
    >
      {children}
    </div>
  );
}
