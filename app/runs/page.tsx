"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, Badge } from "@/components/ui/Card";

interface Run {
  id: string;
  mode: string;
  status: string;
  started_at: number;
  finished_at: number | null;
  offers_fetched: number;
  matches_found: number;
  error?: string | null;
}

interface FullRun extends Run {
  params: string;
  logs: string;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<FullRun | null>(null);

  async function loadList() {
    const r = await fetch("/api/runs");
    const j = await r.json();
    setRuns(j.runs);
    if (j.runs[0] && !selected) loadOne(j.runs[0].id);
  }

  async function loadOne(id: string) {
    const r = await fetch(`/api/runs/${id}`);
    const j = await r.json();
    setSelected(j.run);
  }

  useEffect(() => {
    loadList();
    const t = setInterval(loadList, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight mb-5 md:mb-6">Historique des runs</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="space-y-2 lg:max-h-[80vh] lg:overflow-y-auto">
          {runs.map((r) => (
            <Card
              key={r.id}
              onClick={() => loadOne(r.id)}
              className={`cursor-pointer transition-colors ${
                selected?.id === r.id ? "border-[var(--color-accent)]" : "hover:border-[var(--color-border-strong)]"
              }`}
            >
              <CardBody className="py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] truncate">{r.id}</span>
                  <StatusBadge s={r.status} />
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">
                  {r.mode === "scrape" ? "Scrape FT" : "Base employeurs"} ·{" "}
                  {new Date(r.started_at).toLocaleString("fr-FR")}
                </div>
                <div className="flex gap-2 mt-1.5">
                  <Badge>{r.offers_fetched} offres</Badge>
                  <Badge tone="accent">{r.matches_found} matches</Badge>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        <Card className="lg:col-span-2">
          {selected ? (
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-mono text-[12px]">{selected.id}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {new Date(selected.started_at).toLocaleString("fr-FR")}
                    {selected.finished_at &&
                      ` → ${new Date(selected.finished_at).toLocaleString("fr-FR")}`}
                  </div>
                </div>
                <StatusBadge s={selected.status} />
              </div>

              {selected.error && (
                <div className="mb-3 p-3 rounded-md border border-red-500/30 bg-red-500/10 text-[12px] text-red-200">
                  {selected.error}
                </div>
              )}

              <div className="mb-2 text-[11px] uppercase text-[var(--color-text-dim)] tracking-wide">Logs</div>
              <pre className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[60vh] overflow-auto">
                {selected.logs || "(aucun log)"}
              </pre>
            </div>
          ) : (
            <div className="p-8 text-center text-[var(--color-text-muted)] text-sm">
              Sélectionne un run dans la liste.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  if (s === "running") return <Badge tone="warning">en cours</Badge>;
  if (s === "completed") return <Badge tone="success">terminé</Badge>;
  return <Badge tone="danger">échec</Badge>;
}
