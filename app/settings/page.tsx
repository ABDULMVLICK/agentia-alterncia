"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Check, X, Eye, EyeOff, Save, Zap, Database, Key, Sliders } from "lucide-react";

type SettingKey =
  | "ANTHROPIC_API_KEY"
  | "ANTHROPIC_MODEL"
  | "FRANCE_TRAVAIL_CLIENT_ID"
  | "FRANCE_TRAVAIL_CLIENT_SECRET"
  | "FIREBASE_SERVICE_ACCOUNT_JSON"
  | "FIREBASE_PROJECT_ID"
  | "AGENT_MIN_SCORE"
  | "AGENT_MAX_OFFERS_PER_RUN"
  | "AGENT_MAX_MATCHES_PER_OFFER";

interface Summary {
  configured: Record<SettingKey, boolean>;
  fromDb: Record<SettingKey, boolean>;
  hint: Record<SettingKey, string | null>;
  plain: Partial<Record<SettingKey, string>>;
}

interface TestResult {
  ok: boolean;
  detail: string;
}

export default function SettingsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [values, setValues] = useState<Partial<Record<SettingKey, string>>>({});
  const [reveal, setReveal] = useState<Partial<Record<SettingKey, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [tests, setTests] = useState<Record<string, TestResult> | null>(null);

  async function load() {
    const r = await fetch("/api/settings").then((x) => x.json());
    setSummary(r);
    // Pre-fill non-secret fields with current value
    setValues({
      ANTHROPIC_MODEL: r.plain.ANTHROPIC_MODEL ?? "",
      FIREBASE_PROJECT_ID: r.plain.FIREBASE_PROJECT_ID ?? "",
      AGENT_MIN_SCORE: r.plain.AGENT_MIN_SCORE ?? "",
      AGENT_MAX_OFFERS_PER_RUN: r.plain.AGENT_MAX_OFFERS_PER_RUN ?? "",
      AGENT_MAX_MATCHES_PER_OFFER: r.plain.AGENT_MAX_MATCHES_PER_OFFER ?? "",
      // Secrets: show the hint as a placeholder; the input stays empty until user types.
      ANTHROPIC_API_KEY: r.hint.ANTHROPIC_API_KEY ?? "",
      FRANCE_TRAVAIL_CLIENT_ID: r.hint.FRANCE_TRAVAIL_CLIENT_ID ?? "",
      FRANCE_TRAVAIL_CLIENT_SECRET: r.hint.FRANCE_TRAVAIL_CLIENT_SECRET ?? "",
      FIREBASE_SERVICE_ACCOUNT_JSON: r.hint.FIREBASE_SERVICE_ACCOUNT_JSON ?? "",
    });
  }

  useEffect(() => {
    load();
  }, []);

  function set(k: SettingKey, v: string) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const j = await r.json();
      setSummary(j.summary);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTests(null);
    try {
      const r = await fetch("/api/settings/test", { method: "POST" });
      const j = await r.json();
      setTests(j.results);
    } catch (e: any) {
      setTests({ erreur: { ok: false, detail: e.message } });
    } finally {
      setTesting(false);
    }
  }

  if (!summary) return <div className="p-8 text-[var(--color-text-muted)]">Chargement…</div>;

  return (
    <div className="p-4 md:p-8 max-w-3xl pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Paramètres</h1>
          <p className="text-[13px] md:text-sm text-[var(--color-text-muted)] mt-1">
            Saisis tes clés API ici. Stockées localement (SQLite), jamais renvoyées en clair au front.
          </p>
        </div>
        {/* Desktop action bar */}
        <div className="hidden md:flex gap-2">
          <Button variant="secondary" onClick={runTest} loading={testing}>
            <Zap size={13} /> Tester
          </Button>
          <Button onClick={save} loading={saving}>
            <Save size={13} /> {savedAt ? "Enregistré ✓" : "Enregistrer"}
          </Button>
        </div>
      </div>

      {/* Test results */}
      {tests && (
        <Card className="mb-5">
          <CardHeader>
            <span className="font-semibold text-sm">Test de connexion</span>
          </CardHeader>
          <CardBody className="space-y-2">
            {Object.entries(tests).map(([service, r]) => (
              <div key={service} className="flex items-start gap-3 text-[13px]">
                {r.ok ? (
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <Check size={12} />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-300 flex items-center justify-center shrink-0">
                    <X size={12} />
                  </span>
                )}
                <div>
                  <div className="capitalize font-medium">{service}</div>
                  <div className={`text-[12px] ${r.ok ? "text-[var(--color-text-muted)]" : "text-red-300"}`}>
                    {r.detail}
                  </div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Anthropic */}
      <Section
        title="Anthropic (Claude)"
        subtitle="Pour le scoring de matching et la rédaction des emails"
        icon={<Key size={14} />}
      >
        <SecretField
          k="ANTHROPIC_API_KEY"
          label="API Key"
          placeholder="sk-ant-..."
          hint={summary.hint.ANTHROPIC_API_KEY}
          fromDb={summary.fromDb.ANTHROPIC_API_KEY}
          fromEnv={summary.configured.ANTHROPIC_API_KEY && !summary.fromDb.ANTHROPIC_API_KEY}
          value={values.ANTHROPIC_API_KEY ?? ""}
          onChange={(v) => set("ANTHROPIC_API_KEY", v)}
          reveal={reveal.ANTHROPIC_API_KEY ?? false}
          toggleReveal={() => setReveal((r) => ({ ...r, ANTHROPIC_API_KEY: !r.ANTHROPIC_API_KEY }))}
          helpUrl="https://console.anthropic.com/settings/keys"
          helpText="Obtenir une clé sur console.anthropic.com"
        />
        <PlainField
          k="ANTHROPIC_MODEL"
          label="Modèle (optionnel)"
          placeholder="claude-sonnet-4-6"
          value={values.ANTHROPIC_MODEL ?? ""}
          onChange={(v) => set("ANTHROPIC_MODEL", v)}
        />
      </Section>

      {/* France Travail */}
      <Section
        title="France Travail"
        subtitle="API publique gratuite des offres d'emploi (alternance, stage, etc.)"
        icon={<Database size={14} />}
      >
        <SecretField
          k="FRANCE_TRAVAIL_CLIENT_ID"
          label="Client ID"
          placeholder="PAR_xxx_xxx"
          hint={summary.hint.FRANCE_TRAVAIL_CLIENT_ID}
          fromDb={summary.fromDb.FRANCE_TRAVAIL_CLIENT_ID}
          fromEnv={summary.configured.FRANCE_TRAVAIL_CLIENT_ID && !summary.fromDb.FRANCE_TRAVAIL_CLIENT_ID}
          value={values.FRANCE_TRAVAIL_CLIENT_ID ?? ""}
          onChange={(v) => set("FRANCE_TRAVAIL_CLIENT_ID", v)}
          reveal={reveal.FRANCE_TRAVAIL_CLIENT_ID ?? false}
          toggleReveal={() => setReveal((r) => ({ ...r, FRANCE_TRAVAIL_CLIENT_ID: !r.FRANCE_TRAVAIL_CLIENT_ID }))}
        />
        <SecretField
          k="FRANCE_TRAVAIL_CLIENT_SECRET"
          label="Client Secret"
          placeholder="..."
          hint={summary.hint.FRANCE_TRAVAIL_CLIENT_SECRET}
          fromDb={summary.fromDb.FRANCE_TRAVAIL_CLIENT_SECRET}
          fromEnv={summary.configured.FRANCE_TRAVAIL_CLIENT_SECRET && !summary.fromDb.FRANCE_TRAVAIL_CLIENT_SECRET}
          value={values.FRANCE_TRAVAIL_CLIENT_SECRET ?? ""}
          onChange={(v) => set("FRANCE_TRAVAIL_CLIENT_SECRET", v)}
          reveal={reveal.FRANCE_TRAVAIL_CLIENT_SECRET ?? false}
          toggleReveal={() =>
            setReveal((r) => ({ ...r, FRANCE_TRAVAIL_CLIENT_SECRET: !r.FRANCE_TRAVAIL_CLIENT_SECRET }))
          }
          helpUrl="https://francetravail.io/data/api/offres-emploi"
          helpText="Inscription + activation 'Offres d'emploi v2' sur francetravail.io (gratuit)"
        />
      </Section>

      {/* Firebase */}
      <Section
        title="Firebase Alterncia"
        subtitle="Pour lire la base étudiants (Firestore)"
        icon={<Database size={14} />}
      >
        <PlainField
          k="FIREBASE_PROJECT_ID"
          label="Project ID"
          placeholder="alterncia-prod"
          value={values.FIREBASE_PROJECT_ID ?? ""}
          onChange={(v) => set("FIREBASE_PROJECT_ID", v)}
        />
        <SecretArea
          k="FIREBASE_SERVICE_ACCOUNT_JSON"
          label="Service Account JSON"
          placeholder='{"type":"service_account","project_id":"...",...}'
          hint={summary.hint.FIREBASE_SERVICE_ACCOUNT_JSON}
          fromDb={summary.fromDb.FIREBASE_SERVICE_ACCOUNT_JSON}
          fromEnv={
            summary.configured.FIREBASE_SERVICE_ACCOUNT_JSON && !summary.fromDb.FIREBASE_SERVICE_ACCOUNT_JSON
          }
          value={values.FIREBASE_SERVICE_ACCOUNT_JSON ?? ""}
          onChange={(v) => set("FIREBASE_SERVICE_ACCOUNT_JSON", v)}
          reveal={reveal.FIREBASE_SERVICE_ACCOUNT_JSON ?? false}
          toggleReveal={() =>
            setReveal((r) => ({ ...r, FIREBASE_SERVICE_ACCOUNT_JSON: !r.FIREBASE_SERVICE_ACCOUNT_JSON }))
          }
          helpText="Console Firebase → ⚙️ → Comptes de service → Générer une clé privée. Colle le JSON ici."
        />
      </Section>

      {/* Limites */}
      <Section
        title="Limites & coûts"
        subtitle="Maîtrise le volume de chaque run"
        icon={<Sliders size={14} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PlainField
            k="AGENT_MIN_SCORE"
            label="Score min"
            placeholder="72"
            value={values.AGENT_MIN_SCORE ?? ""}
            onChange={(v) => set("AGENT_MIN_SCORE", v)}
            compact
          />
          <PlainField
            k="AGENT_MAX_OFFERS_PER_RUN"
            label="Max offres / run"
            placeholder="40"
            value={values.AGENT_MAX_OFFERS_PER_RUN ?? ""}
            onChange={(v) => set("AGENT_MAX_OFFERS_PER_RUN", v)}
            compact
          />
          <PlainField
            k="AGENT_MAX_MATCHES_PER_OFFER"
            label="Max matches / offre"
            placeholder="3"
            value={values.AGENT_MAX_MATCHES_PER_OFFER ?? ""}
            onChange={(v) => set("AGENT_MAX_MATCHES_PER_OFFER", v)}
            compact
          />
        </div>
      </Section>

      <div className="text-[11px] text-[var(--color-text-dim)] mt-6">
        💡 Les valeurs saisies ici écrasent les variables d'environnement <code>.env</code>. Laisser un champ
        vide → fallback sur <code>.env</code>. Effacer un champ déjà rempli supprime la valeur en base.
      </div>

      {/* Mobile sticky action bar — above the bottom nav */}
      <div className="md:hidden fixed bottom-[88px] inset-x-0 z-30 px-4">
        <div className="flex gap-2 bg-[var(--color-panel)]/95 backdrop-blur border border-[var(--color-border)] rounded-xl p-2 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]">
          <Button variant="secondary" onClick={runTest} loading={testing} className="flex-1 justify-center">
            <Zap size={13} /> Tester
          </Button>
          <Button onClick={save} loading={saving} className="flex-1 justify-center">
            <Save size={13} /> {savedAt ? "Enregistré ✓" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[var(--color-panel-2)] flex items-center justify-center text-[var(--color-text-muted)]">
            {icon}
          </div>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-[11px] text-[var(--color-text-muted)]">{subtitle}</div>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">{children}</CardBody>
    </Card>
  );
}

interface SecretFieldProps {
  k: string;
  label: string;
  placeholder: string;
  hint: string | null;
  fromDb: boolean;
  fromEnv: boolean;
  value: string;
  onChange: (v: string) => void;
  reveal: boolean;
  toggleReveal: () => void;
  helpText?: string;
  helpUrl?: string;
}

function SecretField(p: SecretFieldProps) {
  const isHintValue = p.value === p.hint && !!p.hint;
  return (
    <div>
      <FieldLabel label={p.label} fromDb={p.fromDb} fromEnv={p.fromEnv} helpText={p.helpText} helpUrl={p.helpUrl} />
      <div className="relative">
        <input
          type={p.reveal ? "text" : "password"}
          value={isHintValue && !p.reveal ? p.hint! : p.value}
          onChange={(e) => p.onChange(e.target.value)}
          placeholder={p.placeholder}
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md pl-3 pr-10 py-2 text-[12.5px] font-mono focus:border-[var(--color-accent)] outline-none"
        />
        <button
          type="button"
          onClick={p.toggleReveal}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          {p.reveal ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function SecretArea(p: SecretFieldProps) {
  const isHintValue = p.value === p.hint && !!p.hint;
  return (
    <div>
      <FieldLabel label={p.label} fromDb={p.fromDb} fromEnv={p.fromEnv} helpText={p.helpText} helpUrl={p.helpUrl} />
      <div className="relative">
        <textarea
          value={isHintValue && !p.reveal ? p.hint! : p.value}
          onChange={(e) => p.onChange(e.target.value)}
          placeholder={p.placeholder}
          rows={4}
          className={`w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[11.5px] font-mono focus:border-[var(--color-accent)] outline-none ${
            !p.reveal && p.value ? "text-transparent caret-[var(--color-text)] [text-security:disc]" : ""
          }`}
          style={!p.reveal && p.value && !isHintValue ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties) : undefined}
        />
        <button
          type="button"
          onClick={p.toggleReveal}
          className="absolute right-2 top-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          {p.reveal ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function PlainField({
  k,
  label,
  placeholder,
  value,
  onChange,
  compact,
}: {
  k: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] text-[var(--color-text-muted)] inline-block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-${
          compact ? "1.5" : "2"
        } text-[13px] focus:border-[var(--color-accent)] outline-none`}
      />
    </div>
  );
}

function FieldLabel({
  label,
  fromDb,
  fromEnv,
  helpText,
  helpUrl,
}: {
  label: string;
  fromDb: boolean;
  fromEnv: boolean;
  helpText?: string;
  helpUrl?: string;
}) {
  return (
    <div className="mb-1">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-2">
          {label}
          {fromDb && <Badge tone="accent">UI</Badge>}
          {fromEnv && <Badge>env</Badge>}
        </label>
        {helpText && (
          <span className="text-[10.5px] text-[var(--color-text-dim)] leading-tight">
            {helpUrl ? (
              <a
                href={helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--color-text-muted)] underline"
              >
                {helpText}
              </a>
            ) : (
              helpText
            )}
          </span>
        )}
      </div>
    </div>
  );
}
