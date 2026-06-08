# Alterncia · Agent de prospection IA

> Agent IA qui **scrape les offres d'emploi**, les **matche avec les étudiants Alterncia**, et **rédige le mail de prospection** à envoyer au décideur.

Construit pour faire venir un maximum de recruteurs sur Alterncia : à chaque match, l'agent surface l'offre + l'étudiant + le contact RH + un email personnalisé prêt à envoyer.

---

## 📐 Stack

- **Next.js 15** (App Router) · React 19 · Tailwind v4
- **Anthropic Claude** (`claude-sonnet-4-6`) — scoring + email
- **France Travail API** — offres publiques (gratuit, OAuth2)
- **Firebase Admin SDK** — lecture de la base étudiants Alterncia
- **SQLite** (better-sqlite3) — cache local, runs, matches

---

## 🚀 Démarrage rapide

```bash
cd ~/Desktop/agent
cp .env.example .env
# édite .env avec tes clés (voir section Config)
npm install
npm run dev
# → http://localhost:3030
```

Puis :

1. **Paramètres** → saisis tes clés directement dans le formulaire (Anthropic, France Travail, Firebase). Bouton **Tester** vérifie que chaque intégration répond avant le 1er run.
2. **Tableau de bord** → bouton "Synchroniser" pour mirroir Firestore en local
3. **Lance un run** (mode Scrape ou Base employeurs)
4. **Matches** → ouvre une carte, copie l'email, envoie-le

> 💡 Les clés saisies dans l'UI sont stockées en SQLite local et écrasent le `.env`. Tu peux donner le lien à la cliente — elle remplit ses propres clés sans toucher au déploiement.

---

## 🔑 Config (.env)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Clé Claude — [console.anthropic.com](https://console.anthropic.com) |
| `ANTHROPIC_MODEL` | défaut `claude-sonnet-4-6` |
| `FRANCE_TRAVAIL_CLIENT_ID` | OAuth2 — [francetravail.io](https://francetravail.io) (gratuit) |
| `FRANCE_TRAVAIL_CLIENT_SECRET` | OAuth2 secret |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service account JSON (inline ou base64) |
| `FIREBASE_PROJECT_ID` | Project id Firebase Alterncia |
| `AGENT_MIN_SCORE` | défaut `72` — seuil pour conserver un match |
| `AGENT_MAX_OFFERS_PER_RUN` | défaut `40` |
| `AGENT_MAX_MATCHES_PER_OFFER` | défaut `3` |

### France Travail — récupérer les clés

1. Inscription [francetravail.io](https://francetravail.io)
2. Crée une appli → demande l'accès à **Offres d'emploi v2** + scope `o2dsoffre`
3. Récupère `client_id` / `client_secret`

### Firebase — récupérer le service account

Dans la console Firebase d'Alterncia → ⚙️ → Comptes de service → Générer une nouvelle clé privée → tu obtiens un JSON.

Pour `.env` local, colle le JSON tel quel sur une seule ligne dans `FIREBASE_SERVICE_ACCOUNT_JSON=`.
Pour Vercel, encode-le en base64 (`base64 -i service-account.json | pbcopy`).

---

## 🧠 Comment ça marche

```
                ┌─────────────────────────────────────────────┐
                │  1. Sync étudiants Alterncia (Firestore)   │
                │     → mirroir SQLite local                  │
                └────────────────────┬────────────────────────┘
                                     │
                ┌────────────────────┴────────────────────────┐
                │  2. Scrape offres (France Travail API)      │
                │     OU base employeurs (companies → offres) │
                └────────────────────┬────────────────────────┘
                                     │
                ┌────────────────────┴────────────────────────┐
                │  3. Pre-filter (règles dures)               │
                │     contrat, diplôme requis                 │
                └────────────────────┬────────────────────────┘
                                     │
                ┌────────────────────┴────────────────────────┐
                │  4. LLM scoring (Claude)                    │
                │     1 appel / offre, top-25 candidats       │
                │     Pondération: métier 25, skills 30,      │
                │     localisation 15, soft 15, autre 15      │
                └────────────────────┬────────────────────────┘
                                     │
                ┌────────────────────┴────────────────────────┐
                │  5. Contact decision-maker                  │
                │     a) email présent dans l'offre           │
                │     b) base employeurs locale               │
                │     c) heuristique contact@domaine.fr       │
                └────────────────────┬────────────────────────┘
                                     │
                ┌────────────────────┴────────────────────────┐
                │  6. Email rédigé (Claude)                   │
                │     Objet + corps personnalisés             │
                │     150-220 mots, signature Léa             │
                └─────────────────────────────────────────────┘
```

### Modes d'exécution

**Mode 1 · Scrape** — recherche d'offres publiques par mots-clés / département / type de contrat (alternance, apprentissage, stage).

**Mode 2 · Base employeurs** — l'agent parcourt ta base d'entreprises et cherche leurs offres récentes sur France Travail. Si une offre n'a pas de contact public, il utilise l'email que tu as fourni en base.

---

## 💰 Coût estimé par run

Avec les valeurs par défaut (40 offres × 1 scoring + ~3 emails) :
- **~45 appels Claude Sonnet 4.6** ≈ 0,15 – 0,30 $ / run
- France Travail : gratuit
- Firebase : gratuit (lectures bien sous le quota)

---

## 🌐 Déploiement Vercel

```bash
vercel
```

### ⚠️ Important sur Vercel : configurer les clés en env vars

Le système de fichiers Vercel est éphémère — la base SQLite est recréée à chaque cold-start. **Les clés saisies dans la page Paramètres seront perdues toutes les ~5-15 min**.

➡️ Sur Vercel, **utilise les variables d'environnement** du dashboard pour les clés. L'agent les lit automatiquement en fallback.

Dans **Project → Settings → Environment Variables**, ajoute :

| Variable | Valeur |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` (optionnel) |
| `FRANCE_TRAVAIL_CLIENT_ID` | `PAR_xxxxx_xxxxx` |
| `FRANCE_TRAVAIL_CLIENT_SECRET` | la clé secrète |
| `FIREBASE_PROJECT_ID` | `alterncia-xxxxx` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | le JSON entier (inline) **ou** sa version base64 (`base64 -i sa.json`) |

Puis **Redeploy** depuis le dashboard. C'est tout.

> Les seuls éléments qui restent éphémères sont l'historique des runs et la base employeurs CSV. Pour les rendre persistants, migrer `lib/db.ts` vers **Vercel Postgres** ou **Turso** (~10 min de boulot).

### Alternative : héberger sur Railway / Render / Fly.io

Si tu veux SQLite persistant + jobs longs, héberge sur un serveur classique :

```bash
# Railway
railway init
railway up
# Render: connecte le repo via le dashboard, Build = npm run build, Start = npm start
```

Tout marche out-of-the-box, la base SQLite persiste, et la cliente peut bien entrer ses clés via `/settings`.

---

## 📦 Structure

```
agent/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── matches/              # Liste + détail
│   ├── runs/                 # Historique
│   ├── employers/            # Base d'employeurs (CSV upload)
│   ├── settings/             # Doc config
│   └── api/
│       ├── agent/run         # POST → lance un run
│       ├── matches           # GET liste / GET-PATCH détail
│       ├── runs              # GET liste / GET détail
│       ├── employers         # GET / POST (CSV ou JSON)
│       └── students/sync     # GET count / POST sync depuis Firestore
├── lib/
│   ├── db.ts                 # SQLite + migrations
│   ├── firestore.ts          # Lecture users Alterncia
│   ├── france-travail.ts     # OAuth2 + search + normalize
│   ├── matching.ts           # Pre-filter + LLM scoring
│   ├── llm.ts                # Claude JSON / text completion
│   ├── enrich.ts             # Contact lookup + employer DB
│   ├── email.ts              # Prompt email + génération
│   ├── students-cache.ts     # Sync Firestore → SQLite
│   └── pipeline.ts           # Orchestrateur du run
└── components/
    ├── Sidebar.tsx
    └── ui/                   # Button, Card, Badge
```

---

## 🛣️ Prochaines étapes (suggestions)

- Branchement Hunter.io / Apollo pour enrichir les contacts low-confidence
- Envoi auto via SMTP (avec rate-limit + tracking opens/clics)
- Cron job qui run tous les matins
- Embeddings (vector search) pour pre-filter plus fin avant LLM
- Migration vers Vercel Postgres / Turso pour la persistance edge
