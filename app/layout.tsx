import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Alterncia · Agent de prospection",
  description: "Agent IA qui scrape les offres d'emploi, matche avec tes étudiants et rédige le mail de prospection.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="min-h-screen flex">
          <Sidebar />
          {/* On mobile: pad top for fixed header (h-14) and bottom for bottom-nav (~64px + safe-area). */}
          <main className="flex-1 min-w-0 pt-14 md:pt-0 pb-[88px] md:pb-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
