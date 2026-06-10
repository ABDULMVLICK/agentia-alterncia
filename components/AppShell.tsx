"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const STANDALONE = ["/login"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (STANDALONE.includes(path)) return <>{children}</>;

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      {/* Mobile padding: top for fixed header (h-14), bottom for bottom-nav (~64px + safe-area). */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0 pb-[88px] md:pb-0">{children}</main>
    </div>
  );
}
