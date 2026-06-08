import { HTMLAttributes } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl ${className}`}
      {...rest}
    />
  );
}

export function CardHeader({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-5 py-4 border-b border-[var(--color-border)] ${className}`} {...rest} />;
}

export function CardBody({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-5 py-4 ${className}`} {...rest} />;
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[var(--color-panel-2)] text-[var(--color-text-muted)] border-[var(--color-border)]",
    success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    danger: "bg-red-500/10 text-red-300 border-red-500/30",
    accent: "bg-violet-500/15 text-violet-200 border-violet-500/40",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
