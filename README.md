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

## 💾 Base de données — Turso (persistante, gratuit)

L'agent utilise **Turso** (managed LibSQL/SQLite). Free tier : 500 DB, 9 GB stockage.

### Setup en 3 min

```bash
# 1. Installer le CLI Turso (une fois)
curl -sSfL https://get.tur.so/install.sh | bash

# 2. Créer un compte + une DB
turso auth signup
turso db create alterncia-agent

# 3. Récupérer les credentials
turso db show alterncia-agent --url        # → libsql://xxxxx.turso.io
turso db tokens create alterncia-agent     # → eyJhbGc...
```

Mettre ces 2 valeurs dans tes env vars (`.env` en local, dashboard Vercel en prod) :
```
TURSO_DATABASE_URL=libsql://alterncia-agent-xxxxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGc...
```

C'est tout. Les tables sont créées automatiquement au premier lancement.

> En local sans Turso configuré → fallback automatique sur SQLite fichier (`./data/agent.db`).

## 🌐 Déploiement Vercel

```bash
vercel
```

### Variables d'environnement à mettre dans Vercel

Dans **Project → Settings → Environment Variables**, ajouter au minimum :

| Variable | Obligatoire ? | Valeur |
|---|---|---|
| `TURSO_DATABASE_URL` | ✅ | `libsql://xxxxx.turso.io` |
| `TURSO_AUTH_TOKEN` | ✅ | token Turso |
| `ANTHROPIC_API_KEY` | optionnel* | `sk-ant-...` |
| `FRANCE_TRAVAIL_CLIENT_ID` | optionnel* | `PAR_xxxxx_xxxxx` |
| `FRANCE_TRAVAIL_CLIENT_SECRET` | optionnel* | clé secrète FT |
| `FIREBASE_PROJECT_ID` | optionnel* | `alterncia-xxxxx` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | optionnel* | JSON inline ou base64 |

\* Optionnel **si** la cliente les saisit dans `/settings`. Sinon, les mettre ici garantit qu'elle n'a rien à toucher.

Puis **Redeploy**. Les clés saisies dans `/settings` sont maintenant persistées (Turso) et survivent aux cold-starts.

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
