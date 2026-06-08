"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui/Card";
import { Sparkles, RefreshCw, ArrowRight, Search, Building2, Users, Target } from "lucide-react";
import Link from "next/link";

interface Run {
  id: string;
  mode: string;
  status: string;
  started_at: number;
  offers_fetched: number;
  matches_found: number;
}

export default function Dashboard() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [studentsCount, setStudentsCount] = useState<number | null>(null);
  const [employersCount, setEmployersCount] = useState<number | null>(null);
  const [running, setRunning] = useState<"scrape" | "employer_db" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Form state
  const [motsCles, setMotsCles] = useState("développeur alternance");
  const [contractType, setContractType] = useState<"apprentissage" | "stage" | "alternance">("alternance");
  const [departement, setDepartement] = useState("");

  async function refresh() {
    try {
      const [rr, sr, er] = await Promise.all([fetch("/api/runs"), fetch("/api/students/sync"), fetch("/api/employers")]);
      for (const x of [rr, sr, er]) {
        if (!x.ok) throw new Error(`API ${x.status} — ${(await x.text()).slice(0, 200)}`);
      }
      const [r, s, e] = await Promise.all([rr.json(), sr.json(), er.json()]);
      setRuns(r.runs);
      setStudentsCount(s.cached);
      setEmployersCount(e.total);
      setApiError(null);
    } catch (e: any) {
      setApiError(e.message ?? String(e));
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  async function syncStudents() {
    setSyncing(true);
    try {
      await fetch("/api/students/sync", { method: "POST" });
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function runScrape() {
    setRunning("scrape");
    try {
      await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "scrape",
          motsCles,
          contractType,
          departement: departement || undefined,
        }),
      });
      await refresh();
    } finally {
      setRunning(null);
    }
  }

  async function runEmployerDb() {
    setRunning("employer_db");
    try {
      await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "employer_db" }),
      });
      await refresh();
    } finally {
      setRunning(null);
    }
  }

  const totalMatches = runs.reduce((s, r) => s + (r.matches_found ?? 0), 0);
  const totalOffers = runs.reduce((s, r) => s + (r.offers_fetched ?? 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="text-[13px] md:text-sm text-[var(--color-text-muted)] mt-1">
          Lance l'agent, surveille les runs, ouvre les meilleurs matches.
        </p>
      </div>

      {apiError && (
        <Card className="border-red-500/30 bg-red-500/10 mb-5">
          <CardBody>
            <div className="text-[13px] font-semibold text-red-200 mb-1">
              Impossible de joindre l'API
            </div>
            <div className="text-[12px] text-red-200/80 break-words whitespace-pre-wrap">{apiError}</div>
            <div className="text-[11.5px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
              Si tu es sur <b>Vercel</b> : la base SQLite n'est pas persistante. Configure tes clés via les
              variables d'environnement Vercel — voir{" "}
              <Link href="/settings" className="underline">
                Paramètres
              </Link>
              .
            </div>
          </CardBody>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3 mb-6 md:mb-8">
        <StatCard label="Étudiants" value={studentsCount ?? "…"} icon={<Users size={16} />} />
        <StatCard label="Employeurs" value={employersCount ?? "…"} icon={<Building2 size={16} />} />
        <StatCard label="Offres" value={totalOffers} icon={<Search size={16} />} />
        <StatCard label="Matches" value={totalMatches} icon={<Target size={16} />} tone="accent" />
      </div>

      {/* Two agent modes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-6 md:mb-8">
        {/* Mode 1: scrape */}
        <Card className="card-glow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-violet-500/15 text-violet-300 flex items-center justify-center">
                <Sparkles size={14} />
              </div>
              <div>
                <div className="font-semibold text-sm">Mode 1 · Scrape France Travail</div>
                <div className="text-[11px] text-[var(--color-text-muted)]">
                  Recherche d'offres publiques par mots-clés
                </div>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <Field label="Mots-clés">
                <input
                  value={motsCles}
                  onChange={(e) => setMotsCles(e.target.value)}
                  placeholder="ex: développeur web alternance"
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-[13px] focus:border-[var(--color-accent)] outline-none"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value as any)}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-[13px] focus:border-[var(--color-accent)] outline-none"
                  >
                    <option value="alternance">Alternance</option>
                    <option value="apprentissage">Apprentissage</option>
                    <option value="stage">Stage</option>
                  </select>
                </Field>
                <Field label="Département (optionnel)">
                  <input
                    value={departement}
                    onChange={(e) => setDepartement(e.target.value)}
                    placeholder="ex: 75"
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-[13px] focus:border-[var(--color-accent)] outline-none"
                  />
                </Field>
              </div>
              <Button onClick={runScrape} loading={running === "scrape"} className="w-full justify-center">
                <Sparkles size={14} /> Lancer le scraping
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Mode 2: employer DB */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-amber-500/15 text-amber-300 flex items-center justify-center">
                <Building2 size={14} />
              </div>
              <div>
                <div className="font-semibold text-sm">Mode 2 · Base employeurs</div>
                <div className="text-[11px] text-[var(--color-text-muted)]">
                  Cherche les offres des entreprises déjà en base
                </div>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-[12px] text-[var(--color-text-muted)] mb-4">
              L'agent parcourt ta base de {employersCount ?? "…"} employeur(s), trouve leurs offres sur France
              Travail, et matche avec les étudiants. Si l'offre n'a pas de contact public, il utilise l'email
              que tu as fourni.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={runEmployerDb}
                loading={running === "employer_db"}
                disabled={(employersCount ?? 0) === 0}
                variant="secondary"
                className="flex-1 justify-center"
              >
                <Building2 size={14} /> Lancer
              </Button>
              <Link href="/employers">
                <Button variant="ghost">
                  Gérer <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Sync students CTA */}
      <Card className="mb-6 md:mb-8">
        <CardBody className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Base étudiants Alterncia</div>
            <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
              {studentsCount ?? "?"} profils en cache local. Synchronise avant de lancer un run pour avoir les
              derniers inscrits.
            </div>
          </div>
          <Button onClick={syncStudents} loading={syncing} variant="secondary" className="justify-center sm:justify-start">
            <RefreshCw size={14} /> Synchroniser
          </Button>
        </CardBody>
      </Card>

      {/* Recent runs */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="font-semibold text-sm">Runs récents</div>
          <Link href="/runs" className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            voir tout →
          </Link>
        </CardHeader>
        <div className="divide-y divide-[var(--color-border)]">
          {runs.slice(0, 5).map((r) => (
            <div key={r.id} className="px-4 md:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[13px]">
              <div className="flex items-center gap-3 min-w-0">
                <StatusDot status={r.status} />
                <div className="min-w-0">
                  <div className="font-mono text-[12px] truncate">{r.id}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    {r.mode === "scrape" ? "Scrape FT" : "Base employeurs"} ·{" "}
                    {new Date(r.started_at).toLocaleString("fr-FR")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 ml-6 sm:ml-0">
                <Badge>{r.offers_fetched} offres</Badge>
                <Badge tone="accent">{r.matches_found} matches</Badge>
                <RunStatusBadge status={r.status} />
              </div>
            </div>
          ))}
          {runs.length === 0 && (
            <div className="px-5 py-8 text-center text-[12px] text-[var(--color-text-muted)]">
              Aucun run pour le moment. Lance ton premier run ci-dessus.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: "accent";
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-1.5 md:mb-2">
          <span className="text-[10px] md:text-[11px] uppercase tracking-wide text-[var(--color-text-dim)]">{label}</span>
          <span className={tone === "accent" ? "text-violet-300" : "text-[var(--color-text-muted)]"}>{icon}</span>
        </div>
        <div className={`text-xl md:text-2xl font-semibold ${tone === "accent" ? "gradient-accent" : ""}`}>{value}</div>
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-[var(--color-text-muted)] mb-1 inline-block">{label}</span>
      {children}
    </label>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "running" ? "bg-amber-400 animate-pulse" : status === "completed" ? "bg-emerald-400" : "bg-red-400";
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} />;
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === "running") return <Badge tone="warning">en cours</Badge>;
  if (status === "completed") return <Badge tone="success">terminé</Badge>;
  return <Badge tone="danger">échec</Badge>;
}
