from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import User, UploadedFile, QueryHistory
from config import JWT_SECRET, ALGORITHM
import jwt
import os
import json
import time
from groq import Groq

router = APIRouter(prefix="/query", tags=["query"])

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class QueryRequest(BaseModel):
    file_id: str
    question: str

# Single shared get_current_user (removed duplicate from files.py)
def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization:
        raise HTTPException(status_code=401, detail="No token")
    try:
        token = authorization.split(" ")[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_csv_schema(csv_data: str) -> str:
    lines = csv_data.strip().split('\n')
    if not lines:
        return ""
    return lines[0]

def infer_column_types(csv_data: str) -> dict:
    lines = csv_data.strip().split('\n')
    if len(lines) < 2:
        return {}
    
    headers = lines[0].split(',')
    first_row = lines[1].split(',')
    
    col_types = {}
    for col, val in zip(headers, first_row):
        col = col.strip()
        try:
            float(val.strip())
            col_types[col] = "REAL"
        except ValueError:
            col_types[col] = "TEXT"
    
    return col_types

def build_prompt(schema: str, question: str, sample_rows: str, col_types: dict) -> str:
    numeric_cols = [col for col, dtype in col_types.items() if dtype == "REAL"]
    all_cols = list(col_types.keys())
    
    return f"""You are a SQL expert. Generate a SQLite SELECT query for this question.

CSV Schema (columns):
{schema}

All available columns: {', '.join(all_cols)}
Numeric columns (use CAST or direct arithmetic): {', '.join(numeric_cols) if numeric_cols else 'None'}

Sample data (first 3 rows):
{sample_rows}

Question: {question}

IMPORTANT RULES:
1. If the question cannot be answered from the available columns above, respond with exactly:
   CANNOT_ANSWER: <brief reason>
   Do NOT invent SQL for questions that don't map to the schema.
2. If the question is not about this dataset (e.g. general knowledge, geography, trivia), respond with exactly:
   CANNOT_ANSWER: This question is not about the uploaded data.
3. Generate ONLY the SELECT statement (no markdown, no backticks, no explanation)
4. Use standard SQLite syntax
5. Column names must match exactly (case-sensitive)
6. Table name is always: data
7. For filtering/sorting on numeric columns, use CAST: CAST(column_name AS REAL)
8. For TOP N within groups, use window functions:
   Example: SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY region ORDER BY CAST(revenue AS REAL) DESC) AS rn FROM data) WHERE rn = 1
9. For running totals: SUM(CAST(amount AS REAL)) OVER (ORDER BY date_col)
10. For period-over-period: use LAG(value) OVER (ORDER BY date_col)
11. For TOP N results globally, use LIMIT clause
12. For numeric comparisons: CAST(column AS REAL) > 500

Return ONLY the SQL query or CANNOT_ANSWER: reason. Nothing else."""

def validate_sql(sql: str) -> tuple[bool, str]:
    """
    Allowlist approach: only permit single SELECT statements.
    Returns (is_valid, reason).
    """
    sql_upper = sql.strip().upper()
    
    # Must start with SELECT
    if not sql_upper.startswith("SELECT"):
        return False, "Only SELECT queries are permitted"
    
    # Block any statement-terminating patterns that could chain queries
    dangerous = [
        "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE",
        "TRUNCATE", "ATTACH", "PRAGMA", "REPLACE", "VACUUM",
        "DETACH", "REINDEX", "ANALYZE"
    ]
    
    import re
    # Check as whole words only (avoids false positives on column names like created_at, updated_date)
    for keyword in dangerous:
        if re.search(rf'\b{keyword}\b', sql_upper):
            return False, f"Query contains disallowed operation: {keyword}"
    
    # Block stacked statements
    if ";" in sql.rstrip(";"):
        return False, "Multiple statements are not permitted"
    
    return True, ""

def call_groq_with_retry(prompt: str, max_retries: int = 2) -> str:
    """Call Groq with timeout and bounded retry on failure."""
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1024,
                temperature=0,
                timeout=30,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                time.sleep(1.5 * (attempt + 1))  # backoff: 1.5s, 3s
    raise RuntimeError(f"LLM unavailable after {max_retries + 1} attempts: {last_error}")

def execute_query(csv_data: str, sql: str, col_types: dict) -> dict:
    import sqlite3
    import io
    import csv

    conn = sqlite3.connect(':memory:')
    
    # Enforce read-only at execution level
    conn.execute("PRAGMA query_only = ON")
    
    cursor = conn.cursor()

    reader = csv.DictReader(io.StringIO(csv_data))
    rows = list(reader)

    if not rows:
        raise Exception("No data")

    cols = list(rows[0].keys())
    
    col_defs = []
    for col in cols:
        dtype = col_types.get(col.strip(), "TEXT")
        col_defs.append(f'"{col}" {dtype}')
    
    # Temporarily disable query_only to load data
    conn.execute("PRAGMA query_only = OFF")
    cursor.execute(f"CREATE TABLE data ({', '.join(col_defs)})")

    placeholders = ', '.join(['?' for _ in cols])
    for row in rows:
        values = [row.get(c, '') for c in cols]
        cursor.execute(f"INSERT INTO data VALUES ({placeholders})", values)

    conn.commit()
    conn.execute("PRAGMA query_only = ON")

    try:
        cursor.execute(sql)
        results = cursor.fetchall()
        col_names = [desc[0] for desc in cursor.description]
        conn.close()
        return {
            "columns": col_names,
            "rows": [dict(zip(col_names, row)) for row in results],
            "count": len(results)
        }
    except Exception as e:
        conn.close()
        raise Exception(f"Query execution failed: {str(e)}")

@router.post("/ask")
def ask_question(
    request: QueryRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    file = db.query(UploadedFile).filter(
        UploadedFile.id == request.file_id,
        UploadedFile.user_id == user.id
    ).first()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    schema = get_csv_schema(file.csv_data)
    col_types = infer_column_types(file.csv_data)
    sample_lines = file.csv_data.split('\n')[:4]
    sample_rows = '\n'.join(sample_lines)
    prompt = build_prompt(schema, request.question, sample_rows, col_types)

    # Call LLM with retry
    try:
        raw_response = call_groq_with_retry(prompt)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable. Please try again in a moment.")

    generated_sql = raw_response.replace('```sql', '').replace('```', '').strip()

    # Handle out-of-scope / unanswerable questions
    if generated_sql.upper().startswith("CANNOT_ANSWER"):
        reason = generated_sql.split(":", 1)[1].strip() if ":" in generated_sql else "This question cannot be answered from the available data."
        raise HTTPException(status_code=400, detail=f"Cannot answer: {reason}")

    # Validate SQL (allowlist approach)
    is_valid, reason = validate_sql(generated_sql)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Query not permitted: {reason}")

    # Execute
    try:
        result = execute_query(file.csv_data, generated_sql, col_types)
    except Exception as e:
        error_msg = str(e)
        # Don't leak internal DB errors to client
        raise HTTPException(status_code=400, detail="Query could not be executed. Try rephrasing your question.")

    # Save to history
    try:
        history = QueryHistory(
            user_id=user.id,
            file_id=request.file_id,
            question=request.question,
            generated_sql=generated_sql,
            results=json.dumps(result)
        )
        db.add(history)
        db.commit()
    except Exception:
        pass  # History failure should not break the response

    return {
        "question": request.question,
        "sql": generated_sql,
        "data": result,
        "row_count": result["count"]
    }
