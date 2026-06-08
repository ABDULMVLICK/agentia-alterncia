import { NextResponse } from "next/server";
import { listEmployers, countEmployers, upsertEmployers, type EmployerRow } from "@/lib/enrich";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      total: countEmployers(),
      employers: listEmployers(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as { employers: EmployerRow[] } | { csv: string };

  if ("csv" in body) {
    const rows = parseCSV(body.csv);
    const n = upsertEmployers(rows);
    return NextResponse.json({ inserted: n });
  }

  if ("employers" in body && Array.isArray(body.employers)) {
    const n = upsertEmployers(body.employers);
    return NextResponse.json({ inserted: n });
  }

  return NextResponse.json({ error: "payload invalide" }, { status: 400 });
}

/**
 * Minimal CSV parser — handles quoted fields with commas, no nested quotes.
 * Expected header (case-insensitive):
 *   company,website,sector,city,contactName,contactEmail,contactRole,notes
 */
function parseCSV(input: string): EmployerRow[] {
  const lines = input.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitCSVLine(lines[0]).map((s) => s.trim().toLowerCase());
  const idx = (key: string) => header.indexOf(key);

  const out: EmployerRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const company = cells[idx("company")] || cells[idx("entreprise")] || "";
    if (!company) continue;
    out.push({
      company: company.trim(),
      website: cells[idx("website")]?.trim() || cells[idx("site")]?.trim(),
      sector: cells[idx("sector")]?.trim() || cells[idx("secteur")]?.trim(),
      city: cells[idx("city")]?.trim() || cells[idx("ville")]?.trim(),
      contactName: cells[idx("contactname")]?.trim() || cells[idx("nom")]?.trim(),
      contactEmail: cells[idx("contactemail")]?.trim() || cells[idx("email")]?.trim(),
      contactRole: cells[idx("contactrole")]?.trim() || cells[idx("fonction")]?.trim(),
      notes: cells[idx("notes")]?.trim(),
    });
  }
  return out;
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}
