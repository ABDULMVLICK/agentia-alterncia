"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Check, X, Copy, ExternalLink, Mail } from "lucide-react";

interface MatchDetail {
  id: string;
  score: number;
  reasons: string;
  gaps: string;
  email_subject: string;
  email_body: string;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  // offer
  offer_title: string;
  company: string;
  city: string;
  contract_type: string;
  url: string;
  offer_description: string;
  sector: string;
  // student
  first_name: string;
  last_name: string;
  student_email: string;
  diplome: string;
  diplome_recherche: string;
  sector_id: string;
  student_city: string;
  metiers: string;
  competences: string;
  soft_skills: string;
  langues: string;
}

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [m, setM] = useState<MatchDetail | null>(null);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then((r) => r.json())
      .then((j) => setM(j.match));
  }, [id]);

  async function setStatus(status: "sent" | "dismissed") {
    await fetch(`/api/matches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.push("/matches");
  }

  function copy(field: "subject" | "body", text: string) {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!m) return <div className="p-8 text-[var(--color-text-muted)]">Chargement…</div>;

  const reasons = safeArr(m.reasons);
  const gaps = safeArr(m.gaps);
  const metiers = safeArr(m.metiers);
  const competences = safeArr(m.competences) as { competence: string; niveau: string }[];
  const softSkills = safeArr(m.soft_skills);
  const langues = safeArr(m.langues) as { langue: string; niveau: string }[];

  const mailto = m.contact_email
    ? `mailto:${m.contact_email}?subject=${encodeURIComponent(m.email_subject)}&body=${encodeURIComponent(m.email_body)}`
    : null;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <Link
        href="/matches"
        className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-3 md:mb-4"
      >
        <ArrowLeft size={14} /> Retour
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* LEFT — Score + Offer */}
        <div className="lg:col-span-2 space-y-4 md:space-y-5">
          {/* Score header */}
          <Card className="card-glow">
            <CardBody>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="text-[11px] text-[var(--color-text-dim)] uppercase tracking-wide mb-1">
                    Score de match
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl md:text-5xl font-bold gradient-accent">{m.score}</span>
                    <span className="text-sm text-[var(--color-text-muted)]">/ 100</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStatus("dismissed")} className="flex-1 sm:flex-none justify-center">
                    <X size={14} /> Écarter
                  </Button>
                  <Button onClick={() => setStatus("sent")} className="flex-1 sm:flex-none justify-center">
                    <Check size={14} /> <span className="hidden sm:inline">Marquer </span>envoyé
                  </Button>
                </div>
              </div>

              {reasons.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-dim)] mb-2">
                    Raisons du match
                  </div>
                  <ul className="space-y-1.5">
                    {reasons.map((r, i) => (
                      <li key={i} className="text-[13px] flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {gaps.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-dim)] mb-2">
                    Limites à anticiper
                  </div>
                  <ul className="space-y-1">
                    {gaps.map((g, i) => (
                      <li key={i} className="text-[12px] text-[var(--color-text-muted)] flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5">!</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Email draft */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[var(--color-text-muted)]" />
                <span className="font-semibold text-sm">Email de prospection</span>
              </div>
              {mailto && (
                <a href={mailto} className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full sm:w-auto justify-center">
                    <Mail size={13} /> Ouvrir
                  </Button>
                </a>
              )}
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-dim)]">Objet</span>
                  <button
                    onClick={() => copy("subject", m.email_subject)}
                    className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1"
                  >
                    <Copy size={11} /> {copied === "subject" ? "copié" : "copier"}
                  </button>
                </div>
                <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[13px]">
                  {m.email_subject}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-dim)]">Corps</span>
                  <button
                    onClick={() => copy("body", m.email_body)}
                    className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1"
                  >
                    <Copy size={11} /> {copied === "body" ? "copié" : "copier"}
                  </button>
                </div>
                <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-3 text-[13px] whitespace-pre-wrap leading-relaxed">
                  {m.email_body}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Offer */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <span className="font-semibold text-sm">Offre source</span>
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-[var(--color-accent-2)] hover:underline flex items-center gap-1"
              >
                Voir l'annonce <ExternalLink size={11} />
              </a>
            </CardHeader>
            <CardBody>
              <div className="text-[15px] font-semibold mb-1">{m.offer_title}</div>
              <div className="text-[12px] text-[var(--color-text-muted)] mb-3">
                {m.company} · {m.city} · {m.contract_type} · {m.sector}
              </div>
              <div className="text-[13px] text-[var(--color-text-muted)] whitespace-pre-wrap line-clamp-[12] leading-relaxed">
                {m.offer_description}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* RIGHT — Contact + Student */}
        <div className="space-y-4 md:space-y-5">
          <Card>
            <CardHeader>
              <span className="font-semibold text-sm">Contact à démarcher</span>
            </CardHeader>
            <CardBody className="space-y-2">
              {m.contact_email ? (
                <>
                  <div>
                    <div className="text-[11px] text-[var(--color-text-dim)] uppercase">Email</div>
                    <div className="text-[13px] font-mono break-all">{m.contact_email}</div>
                  </div>
                  {m.contact_name && (
                    <div>
                      <div className="text-[11px] text-[var(--color-text-dim)] uppercase">Nom</div>
                      <div className="text-[13px]">{m.contact_name}</div>
                    </div>
                  )}
                  {m.contact_role && (
                    <div>
                      <div className="text-[11px] text-[var(--color-text-dim)] uppercase">Rôle</div>
                      <div className="text-[13px]">{m.contact_role}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[12px] text-[var(--color-text-muted)]">
                  Aucun contact direct trouvé. Cherche le décideur sur LinkedIn ou via le site de
                  l'entreprise, puis ajoute-le à la base employeurs pour la prochaine fois.
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <span className="font-semibold text-sm">Étudiant matché</span>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <div className="text-[15px] font-semibold">
                  {m.first_name} {m.last_name}
                </div>
                <div className="text-[12px] text-[var(--color-text-muted)] font-mono">{m.student_email}</div>
              </div>

              <KV label="Diplôme visé" value={(m.diplome_recherche ?? m.diplome ?? "").toUpperCase()} />
              <KV label="Ville" value={m.student_city ?? "—"} />

              {metiers.length > 0 && (
                <div>
                  <div className="text-[11px] text-[var(--color-text-dim)] uppercase mb-1">Métiers visés</div>
                  <div className="flex flex-wrap gap-1">
                    {metiers.slice(0, 4).map((x: string, i: number) => (
                      <Badge key={i}>{x}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {competences.length > 0 && (
                <div>
                  <div className="text-[11px] text-[var(--color-text-dim)] uppercase mb-1">Compétences clés</div>
                  <div className="flex flex-wrap gap-1">
                    {competences.slice(0, 6).map((c, i) => (
                      <Badge key={i} tone="accent">
                        {c.competence}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {softSkills.length > 0 && (
                <div>
                  <div className="text-[11px] text-[var(--color-text-dim)] uppercase mb-1">Soft skills</div>
                  <div className="flex flex-wrap gap-1">
                    {softSkills.slice(0, 5).map((x: string, i: number) => (
                      <Badge key={i}>{x}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {langues.length > 0 && (
                <div>
                  <div className="text-[11px] text-[var(--color-text-dim)] uppercase mb-1">Langues</div>
                  <div className="flex flex-wrap gap-1">
                    {langues.map((l, i) => (
                      <Badge key={i}>
                        {l.langue} · {l.niveau}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--color-text-dim)] uppercase">{label}</div>
      <div className="text-[13px]">{value}</div>
    </div>
  );
}

function safeArr(s: string | null | undefined): any[] {
  if (!s) return [];
  try {
    const j = JSON.parse(s);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}
