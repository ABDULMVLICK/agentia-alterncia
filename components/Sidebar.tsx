"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, History, Building2, Settings, Users } from "lucide-react";

const NAV = [
  { href: "/", label: "Tableau", mobileLabel: "Home", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", mobileLabel: "Matches", icon: Sparkles },
  { href: "/runs", label: "Historique", mobileLabel: "Runs", icon: History },
  { href: "/employers", label: "Base employeurs", mobileLabel: "Employeurs", icon: Building2 },
  { href: "/settings", label: "Paramètres", mobileLabel: "Réglages", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <>
      {/* ============ Desktop sidebar (md+) ============ */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex-col">
        <div className="px-5 pt-6 pb-4 flex items-center gap-2.5 border-b border-[var(--color-border)]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] flex items-center justify-center">
            <Users size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Alterncia</div>
            <div className="text-[11px] text-[var(--color-text-muted)] leading-tight">Agent prospection</div>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
                  active
                    ? "bg-[var(--color-panel-2)] text-[var(--color-text)] border border-[var(--color-border)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]"
                }`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[var(--color-border)]">
          <div className="text-[11px] text-[var(--color-text-dim)] px-2">v0.1 · MVP</div>
        </div>
      </aside>

      {/* ============ Mobile top bar ============ */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-[var(--color-panel)]/95 backdrop-blur border-b border-[var(--color-border)] flex items-center px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] flex items-center justify-center">
            <Users size={14} className="text-white" />
          </div>
          <div>
            <div className="text-[13px] font-semibold leading-tight">Alterncia</div>
            <div className="text-[10px] text-[var(--color-text-muted)] leading-tight">Agent prospection</div>
          </div>
        </div>
      </header>

      {/* ============ Mobile bottom nav ============ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--color-panel)]/95 backdrop-blur border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {NAV.map(({ href, mobileLabel, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors ${
                  active ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-muted)] active:text-[var(--color-text)]"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[10px] font-medium tracking-tight">{mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
