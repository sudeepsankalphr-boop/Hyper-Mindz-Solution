# HyperMindZ Solution — NL-to-SQL Data Query & Visualization System

Ask natural language questions against your CSV data. Get accurate answers, charts, and the generated SQL — no technical knowledge required.

**Live App:** https://hyper-mindz-solution.vercel.app  
**Backend:** https://hyper-mindz-solution-1.onrender.com  
**Stack:** FastAPI · SQLite (in-memory) · Groq llama-3.3-70b · Next.js · Recharts · Google OAuth

---

## Quick Start (Test Credentials)

```
Email:    test@hypermindz.com
Password: test1234
```

A sample e-commerce dataset (500+ rows) is pre-loaded on this account.

---

## Sample Queries to Try

| Query | Expected Result |
|---|---|
| What is the total revenue by category? | Bar chart + table grouped by category |
| Show all orders over $500 from Q4 | Filtered table |
| What are the top 10 products by sales volume? | Sorted table, LIMIT 10 |
| Average order value by region | Table with aggregation |
| How did monthly revenue change over the past year? | Line chart by month |
| Which region has the highest number of orders? | Single-row result |
| Show revenue and order count by category | Multi-column grouped table |
| What percentage of total revenue does each category contribute? | Table with ratio math |

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Groq API key (free at console.groq.com)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Fill in JWT_SECRET and GROQ_API_KEY in .env

python main.py
# Backend runs at http://localhost:8001
```

### Frontend

```bash
cd frontend
npm install

# Create .env.local file
echo "NEXT_PUBLIC_API_URL=http://localhost:8001" > .env.local

npm run dev
# Frontend runs at http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

```
JWT_SECRET=your-strong-random-secret-here
GROQ_API_KEY=your-groq-api-key-here
```

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_API_URL=https://hyper-mindz-solution-1.onrender.com
GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

See `backend/.env.example` for reference.

---

## Architecture

```
User Browser (Next.js on Vercel)
        │
        │  REST API (JWT auth)
        ▼
FastAPI Backend (Render)
        │
        ├── Auth: bcrypt passwords, JWT tokens, Google OAuth
        ├── Files: CSV upload → stored in SQLite (per user)
        ├── Query Pipeline:
        │     1. Load user's CSV into in-memory SQLite
        │     2. Extract schema + sample rows + column types
        │     3. Build schema-aware prompt → Groq llama-3.3-70b
        │     4. Validate generated SQL (SELECT-only allowlist)
        │     5. Execute against in-memory DB → return results
        └── Multi-tenant isolation: every query scoped by user_id
```

### NL-to-SQL Pipeline

1. **Schema introspection** — column names and inferred types (REAL vs TEXT) extracted from CSV headers + first row
2. **Prompt design** — schema, column types, and 3 sample rows injected into prompt; temperature=0 for deterministic output; window function examples included for per-group queries
3. **Query validation** — SELECT-only allowlist; anything that isn't a read-only SELECT is rejected with a 400 before execution
4. **In-memory execution** — CSV loaded into a fresh SQLite `:memory:` DB per query; no persistence, no cross-user data leakage possible
5. **Result routing** — frontend decides chart vs table based on column count and data shape

### Why This Stack

- **Groq + llama-3.3-70b**: Free tier, ~200ms latency, strong SQL generation
- **SQLite in-memory**: No DB server needed; throwaway per query = safe by design
- **FastAPI**: Fast to build, automatic OpenAPI docs, async-ready
- **Next.js**: File-based routing, easy Vercel deploy, TypeScript support
- **Recharts**: Simple React-native charting, good defaults

---

## Database Schema

```sql
users         (id, email, password_hash, created_at)
uploaded_files (id, user_id, filename, csv_data, columns, row_count, created_at)
query_history  (id, user_id, file_id, question, generated_sql, results, created_at)
```

All SQLite. `csv_data` stores raw CSV text; queries load it into a fresh in-memory DB each time.

---

## AI Tool Usage

Built using Claude (architecture decisions, code generation, debugging) and Cursor for IDE integration. All generated code was reviewed, tested, and understood before committing — not blind copy-paste. Key overrides made manually:

- Chose Groq over OpenAI for free-tier reliability
- Kept SQLite in-memory instead of PostgreSQL (simpler, safer for this scope)
- Wrote schema-aware prompt manually after AI-generated version was too generic

---

## Trade-offs & Known Limitations

| Decision | Trade-off |
|---|---|
| In-memory SQLite per query | Safe and simple, but re-parses CSV every query — slow on large files |
| JWT in localStorage | Simple to implement; susceptible to XSS. HttpOnly cookies would be safer |
| Single LLM call per query | No self-correction on bad SQL; occasional hallucinated column names on complex questions |
| No streaming | Full response wait; streaming would improve perceived latency |

---

## Scaling to 1M+ Rows

The current architecture has two bottlenecks at large scale:

1. **CSV stored as text in SQLite** — the full file sits in a single `csv_data` column. At 1M rows that's potentially 500MB+ per row. Fix: store files in object storage (S3/Cloudflare R2), keep only metadata in the DB, stream on demand.

2. **In-memory SQLite per query** — every query re-parses and loads the entire CSV into `:memory:`. Fix: replace with **DuckDB** — columnar engine, queries Parquet/CSV files directly without full memory load, handles 1M+ rows in milliseconds with minimal code change.

3. **Result pagination** — return the first N rows with a `has_more` flag instead of dumping the full result to the browser.

The NL-to-SQL pipeline itself (schema introspection, prompt design, SQL generation) needs no changes — it scales independently of row count.

---

## Installing as an App (PWA)

The app is a Progressive Web App — it can be installed on any device and runs like a native app with no browser chrome.

| Platform | How to install |
|---|---|
| **Android (Chrome)** | Tap the "Add to Home Screen" banner or the install icon in the address bar |
| **iOS (Safari)** | Tap Share → "Add to Home Screen" |
| **Desktop Chrome / Edge** | Click the install icon in the right side of the address bar |
| **Desktop Firefox** | Not supported — use as a normal website |

Once installed, the app opens standalone (no browser UI) and appears in your app launcher like any other app.

---

## Deployment

### Render (Backend)

Environment variables to set in Render dashboard:
- `JWT_SECRET` — strong random string
- `GROQ_API_KEY` — from console.groq.com

Note: Render free tier has cold-start delays of ~50 seconds after inactivity.

### Vercel (Frontend)

Environment variables to set in Vercel dashboard:
- `NEXT_PUBLIC_API_URL` — your Render backend URL
- `GOOGLE_CLIENT_ID` — from Google Cloud Console (OAuth 2.0 Client ID)
