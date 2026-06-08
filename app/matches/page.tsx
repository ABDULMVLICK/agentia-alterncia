"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Card";
import { Sparkles, MapPin, Briefcase } from "lucide-react";

interface Match {
  id: string;
  score: number;
  offer_title: string;
  company: string;
  city: string;
  contract_type: string;
  first_name: string;
  last_name: string;
  diplome_recherche: string;
  diplome: string;
  contact_email: string | null;
  status: string;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [minScore, setMinScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch(`/api/matches?min=${minScore}`);
      if (!r.ok) throw new Error(`API ${r.status} — ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      setMatches(j.matches ?? []);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [minScore]);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Matches</h1>
          <p className="text-[13px] md:text-sm text-[var(--color-text-muted)] mt-1">
            {matches.length} match(s) · tape sur une carte pour le mail
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-[var(--color-text-muted)] shrink-0">Score min</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minScore}
            onChange={(e) => setMinScore(+e.target.value)}
            className="flex-1 md:w-32 md:flex-none"
          />
          <span className="font-mono text-[12px] w-8 text-right">{minScore}</span>
        </div>
      </div>

      {loading && <div className="text-[var(--color-text-muted)] text-sm">Chargement…</div>}

      {error && (
        <Card className="border-red-500/30 bg-red-500/10 mb-4">
          <div className="p-4 text-[13px]">
            <div className="font-semibold text-red-200 mb-1">Erreur API</div>
            <div className="text-red-200/80 break-words whitespace-pre-wrap">{error}</div>
          </div>
        </Card>
      )}

      {!loading && !error && matches.length === 0 && (
        <Card className="p-12 text-center">
          <Sparkles className="mx-auto mb-3 text-[var(--color-text-dim)]" size={32} />
          <div className="text-sm text-[var(--color-text-muted)]">
            Aucun match pour le moment. Lance un run depuis le tableau de bord.
          </div>
        </Card>
      )}

      <div className="space-y-2.5">
        {matches.map((m) => (
          <Link key={m.id} href={`/matches/${m.id}`}>
            <Card className="hover:border-[var(--color-border-strong)] active:bg-[var(--color-panel-2)] transition-colors cursor-pointer">
              {/* Mobile layout: stacked. Desktop: row. */}
              <div className="px-4 md:px-5 py-3.5 md:py-4 flex md:items-center gap-3 md:gap-4">
                <ScoreCircle score={m.score} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="text-[13.5px] md:text-[14px] font-semibold truncate">{m.offer_title}</div>
                    {m.status === "sent" && <Badge tone="success">envoyé</Badge>}
                    {m.status === "dismissed" && <Badge>écarté</Badge>}
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 text-[11.5px] md:text-[12px] text-[var(--color-text-muted)] flex-wrap">
                    <span className="flex items-center gap-1">
                      <Briefcase size={11} />
                      <span className="truncate max-w-[120px] md:max-w-none">{m.company}</span>
                    </span>
                    {m.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        {m.city}
                      </span>
                    )}
                    <span className="capitalize">{m.contract_type}</span>
                  </div>

                  {/* Mobile-only inline meta */}
                  <div className="md:hidden mt-2 pt-2 border-t border-[var(--color-border)] grid grid-cols-2 gap-2 text-[11.5px]">
                    <div>
                      <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wide">
                        Étudiant
                      </div>
                      <div className="font-medium truncate">
                        {m.first_name} {m.last_name}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wide">
                        Contact
                      </div>
                      {m.contact_email ? (
                        <div className="truncate">{m.contact_email}</div>
                      ) : (
                        <Badge tone="warning">à enrichir</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop-only side columns */}
                <div className="hidden md:block border-l border-[var(--color-border)] pl-4 min-w-[180px]">
                  <div className="text-[11px] text-[var(--color-text-dim)] uppercase tracking-wide mb-0.5">
                    Étudiant matché
                  </div>
                  <div className="text-[13px] font-medium">
                    {m.first_name} {m.last_name}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    {(m.diplome_recherche ?? m.diplome ?? "").toUpperCase()}
                  </div>
                </div>

                <div className="hidden md:block border-l border-[var(--color-border)] pl-4 min-w-[160px]">
                  <div className="text-[11px] text-[var(--color-text-dim)] uppercase tracking-wide mb-0.5">
                    Contact
                  </div>
                  {m.contact_email ? (
                    <div className="text-[12px] truncate max-w-[160px]">{m.contact_email}</div>
                  ) : (
                    <Badge tone="warning">à enrichir</Badge>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 90 ? "#34d399" : score >= 80 ? "#7c5cff" : score >= 70 ? "#5acbff" : "#fbbf24";
  return (
    <div className="relative w-14 h-14">
      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
        <circle cx="18" cy="18" r="16" stroke="#25252c" strokeWidth="3" fill="none" />
        <circle
          cx="18"
          cy="18"
          r="16"
          stroke={color}
          strokeWidth="3"
          fill="none"
          strokeDasharray={`${(score / 100) * 100.5} 100.5`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold">
        {score}
      </div>
    </div>
  );
}
