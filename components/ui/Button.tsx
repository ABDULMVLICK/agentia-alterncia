"use client";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const STYLES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-[var(--color-accent)] to-[#6c4af0] text-white hover:brightness-110 shadow-[0_0_0_1px_rgba(124,92,255,0.4),0_8px_24px_-12px_rgba(124,92,255,0.7)]",
  secondary:
    "bg-[var(--color-panel-2)] text-[var(--color-text)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
  ghost: "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]",
  danger: "bg-[var(--color-danger)] text-white hover:brightness-110",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", loading, className = "", children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${STYLES[variant]} ${className}`}
      {...rest}
    >
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
});
