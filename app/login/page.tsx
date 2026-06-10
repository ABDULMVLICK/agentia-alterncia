"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Authentification échouée");
        setLoading(false);
        return;
      }
      // Hard nav so middleware re-evaluates with the new cookie
      window.location.href = next;
    } catch (e: any) {
      setError(e.message ?? String(e));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)]">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] flex items-center justify-center shrink-0">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-tight">Alterncia</div>
            <div className="text-[12px] text-[var(--color-text-muted)] leading-tight">Agent prospection</div>
          </div>
        </div>

        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl p-5 card-glow">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-md bg-[var(--color-panel-2)] flex items-center justify-center text-[var(--color-text-muted)]">
              <Lock size={13} />
            </div>
            <div>
              <div className="text-sm font-semibold">Accès protégé</div>
              <div className="text-[11px] text-[var(--color-text-muted)]">Saisis le mot de passe partagé</div>
            </div>
          </div>

          <label className="block mb-3">
            <span className="text-[11px] text-[var(--color-text-muted)] mb-1 inline-block">Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[13px] focus:border-[var(--color-accent)] outline-none"
            />
          </label>

          {error && (
            <div className="mb-3 px-3 py-2 rounded-md border border-red-500/30 bg-red-500/10 text-[12px] text-red-200">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} disabled={!password.trim()} className="w-full justify-center">
            <Lock size={13} /> Entrer
          </Button>
        </div>

        <div className="text-[11px] text-[var(--color-text-dim)] text-center mt-4">
          Cet outil est réservé à l'équipe Alterncia.
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
