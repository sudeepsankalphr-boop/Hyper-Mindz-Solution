# HyperMindZ Solution — NL-to-SQL Data Query & Visualization System

Ask natural language questions against your CSV data. Get accurate answers, charts, and the generated SQL — no technical knowledge required.

**Live App:** https://hyper-mindz-solution.vercel.app  
**Backend:** https://hyper-mindz-solution-production.up.railway.app  
**Stack:** FastAPI · SQLite (in-memory) · Groq llama-3.3-70b · Next.js · Recharts

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
NEXT_PUBLIC_API_URL=https://hyper-mindz-solution-production.up.railway.app
```

See `backend/.env.example` for reference.

---

## Architecture

```
User Browser (Next.js on Vercel)
        │
        │  REST API (JWT auth)
        ▼
FastAPI Backend (Railway)
        │
        ├── Auth: bcrypt passwords, JWT tokens
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
| Single LLM call per query | No retry on bad SQL; occasional hallucinated column names on complex questions |
| No streaming | Full response wait; streaming would improve perceived latency |

---

## What I'd Improve With More Time

1. **Read-only SQLite connection** (`PRAGMA query_only = ON`) as a second safety layer
2. **Groq retry with backoff** on rate limits
3. **Conversation context** — follow-up questions referencing previous results
4. **Data profiling on upload** — auto-generate summary stats
5. **Disable `/docs` in production** — FastAPI's Swagger UI is currently public
6. **Tests** — unit tests for SQL validator, auth, and per-user isolation

---

## Deployment

### Railway (Backend)

Environment variables to set in Railway dashboard:
- `JWT_SECRET` — strong random string (not the default)
- `GROQ_API_KEY` — from console.groq.com

### Vercel (Frontend)

Environment variable to set in Vercel dashboard:
- `NEXT_PUBLIC_API_URL` — your Railway backend URL

Note: Railway free tier has cold-start delays of 30–60 seconds after inactivity.
