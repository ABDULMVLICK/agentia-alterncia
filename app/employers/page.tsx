"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, Plus } from "lucide-react";

interface Employer {
  company: string;
  website?: string;
  sector?: string;
  city?: string;
  contactName?: string;
  contactEmail?: string;
  contactRole?: string;
}

export default function EmployersPage() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [uploading, setUploading] = useState(false);
  const [draftCsv, setDraftCsv] = useState("");

  async function load() {
    const r = await fetch("/api/employers");
    const j = await r.json();
    setEmployers(j.employers);
  }
  useEffect(() => {
    load();
  }, []);

  async function importCsv() {
    if (!draftCsv.trim()) return;
    setUploading(true);
    try {
      await fetch("/api/employers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: draftCsv }),
      });
      setDraftCsv("");
      await load();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-5 md:mb-6">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Base employeurs</h1>
        <p className="text-[13px] md:text-sm text-[var(--color-text-muted)] mt-1">
          {employers.length} entreprise(s) · emails utilisés pour le mode "base employeurs"
        </p>
      </div>

      <Card className="mb-5 md:mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload size={14} className="text-[var(--color-text-muted)]" />
            <span className="font-semibold text-sm">Import CSV</span>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-[11.5px] md:text-[12px] text-[var(--color-text-muted)] mb-2">
            Colonnes :{" "}
            <code className="text-[10.5px] md:text-[11px] bg-[var(--color-bg)] px-1.5 py-0.5 rounded break-all">
              company, contactName, contactEmail, contactRole, city…
            </code>
            <br />
            <span className="text-[11px]">Alias FR ok (entreprise, nom, email, fonction, ville).</span>
          </p>
          <textarea
            value={draftCsv}
            onChange={(e) => setDraftCsv(e.target.value)}
            placeholder={`company,city,contactName,contactEmail,contactRole\nAcme SAS,Paris,Marie Dupont,marie@acme.fr,DRH`}
            rows={6}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[11.5px] md:text-[12px] font-mono focus:border-[var(--color-accent)] outline-none"
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={importCsv}
              loading={uploading}
              disabled={!draftCsv.trim()}
              className="w-full sm:w-auto justify-center"
            >
              <Plus size={13} /> Importer
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wide text-[var(--color-text-dim)]">
                <Th>Entreprise</Th>
                <Th>Secteur · Ville</Th>
                <Th>Contact</Th>
                <Th>Email</Th>
              </tr>
            </thead>
            <tbody>
              {employers.map((e, i) => (
                <tr key={i} className="border-b border-[var(--color-border)] hover:bg-[var(--color-panel-2)]">
                  <Td>
                    <div className="font-medium">{e.company}</div>
                    {e.website && <div className="text-[11px] text-[var(--color-text-muted)]">{e.website}</div>}
                  </Td>
                  <Td>
                    {e.sector && <div>{e.sector}</div>}
                    {e.city && <div className="text-[11px] text-[var(--color-text-muted)]">{e.city}</div>}
                  </Td>
                  <Td>
                    {e.contactName && <div>{e.contactName}</div>}
                    {e.contactRole && <div className="text-[11px] text-[var(--color-text-muted)]">{e.contactRole}</div>}
                  </Td>
                  <Td>
                    {e.contactEmail ? (
                      <span className="font-mono text-[11px]">{e.contactEmail}</span>
                    ) : (
                      <Badge tone="warning">aucun</Badge>
                    )}
                  </Td>
                </tr>
              ))}
              {employers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[12px] text-[var(--color-text-muted)]">
                    Aucun employeur. Importe un CSV ci-dessus.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {employers.map((e, i) => (
          <Card key={i}>
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-[14px] truncate">{e.company}</div>
                {!e.contactEmail && <Badge tone="warning">aucun</Badge>}
              </div>
              {(e.sector || e.city) && (
                <div className="text-[11.5px] text-[var(--color-text-muted)] mt-0.5">
                  {[e.sector, e.city].filter(Boolean).join(" · ")}
                </div>
              )}
              {(e.contactName || e.contactRole) && (
                <div className="text-[12px] mt-1.5">
                  {e.contactName}
                  {e.contactRole && (
                    <span className="text-[var(--color-text-muted)]"> · {e.contactRole}</span>
                  )}
                </div>
              )}
              {e.contactEmail && (
                <div className="font-mono text-[11px] mt-1 break-all">{e.contactEmail}</div>
              )}
            </div>
          </Card>
        ))}
        {employers.length === 0 && (
          <Card>
            <div className="p-8 text-center text-[12px] text-[var(--color-text-muted)]">
              Aucun employeur. Importe un CSV ci-dessus.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
