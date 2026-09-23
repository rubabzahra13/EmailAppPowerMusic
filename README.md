# Power Music Ops

Admin portal for partner roster requests and customer-support email (Gmail + AI drafts).  
Stack: **React / Vite** frontend, **FastAPI** backend, **Supabase** (Postgres + Auth + Realtime), deployed on **Vercel**.

## Repository layout

```text
powermusicmock/
├── frontend/          # React app (admin + manager submit portal)
├── backend/           # FastAPI API + Gmail / AI pipeline
├── supabase/          # SQL migrations & auth helpers
├── scripts/           # One-off ops (seed admin, auth URL config)
├── docs/              # Setup guides (Gmail, auth, test emails)
└── vercel.json        # Frontend + backend services + crons
```

Do **not** commit secrets, virtualenvs, or `node_modules`. Copy from the `.env.example` files.

## Local development

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # fill DATABASE_URL, Supabase, Gmail, etc.
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000  
- OpenAPI: http://localhost:8000/docs  

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local         # fill VITE_SUPABASE_URL + ANON_KEY
npm install
npm run dev                        # http://localhost:3000
```

From the repo root you can also run:

```bash
npm run dev:frontend
npm run dev:backend
```

### 3. Database

Use the Supabase **transaction pooler** URL (`…pooler.supabase.com:6543`) in `backend/.env`.  
Apply migrations with Alembic when schema changes:

```bash
cd backend && source .venv/bin/activate && alembic upgrade head
```

## Production checklist

- [ ] `backend/.env` / Vercel env: `DATABASE_URL`, `SUPABASE_URL`, JWT/JWKS, `TOKEN_ENCRYPTION_KEY`
- [ ] Gmail live: `PILOT2_GMAIL_MODE=live`, OAuth client, `GOOGLE_REDIRECT_URI` = production callback
- [ ] Optional instant mail: `PILOT2_GMAIL_PUBSUB_TOPIC` + push token; `SUPABASE_SERVICE_ROLE_KEY` for Realtime nudges
- [ ] Cron secret set for `/api/pilot2/poll` and distill jobs
- [ ] Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only (never service role)
- [ ] Reconnect every Gmail inbox after rotating `TOKEN_ENCRYPTION_KEY`

## Docs

| Doc | Topic |
|-----|--------|
| [docs/AUTH.md](docs/AUTH.md) | Supabase auth / roles |
| [docs/GOOGLE_GMAIL_SETUP.md](docs/GOOGLE_GMAIL_SETUP.md) | Gmail OAuth + push |
| [docs/test-emails.md](docs/test-emails.md) | Sample emails for AI intents |

## Security

- Never commit `.env`, `.env.local`, or backup env files
- Encrypt Gmail refresh tokens with `TOKEN_ENCRYPTION_KEY`
- Service role key is server-only
- Default CSP / security headers live in `vercel.json`
