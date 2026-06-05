from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import User, UploadedFile, QueryHistory
import jwt
import os
import json
from groq import Groq

router = APIRouter(prefix="/query", tags=["query"])

JWT_SECRET = os.getenv("JWT_SECRET", "test-secret-key")
ALGORITHM = "HS256"

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class QueryRequest(BaseModel):
    file_id: str
    question: str

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
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_csv_schema(csv_data: str) -> str:
    lines = csv_data.strip().split('\n')
    if not lines:
        return ""
    return lines[0]

def infer_column_types(csv_data: str) -> dict:
    """Infer numeric vs text columns from sample data"""
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
    
    return f"""You are a SQL expert. Generate a SQLite SELECT query for this question.

CSV Schema (columns):
{schema}

Numeric columns (use CAST or direct arithmetic): {', '.join(numeric_cols) if numeric_cols else 'None'}

Sample data (first 3 rows):
{sample_rows}

Question: {question}

IMPORTANT RULES:
1. Generate ONLY the SELECT statement (no markdown, no backticks, no explanation)
2. Use standard SQLite syntax
3. Column names must match exactly (case-sensitive)
4. Table name is always: data
5. For filtering/sorting on numeric columns, use CAST: CAST(column_name AS REAL)
6. For aggregations (SUM, AVG, COUNT, MAX, MIN), use GROUP BY with matching column names
7. Example: SELECT category, CAST(SUM(CAST(revenue AS REAL)) AS INTEGER) AS total_revenue FROM data GROUP BY category ORDER BY total_revenue DESC
8. For TOP N results, use LIMIT clause
9. For numeric comparisons: CAST(column AS REAL) > 500, not column > 500

Return ONLY the SQL query, nothing else."""

def validate_sql(sql: str) -> bool:
    dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE']
    for keyword in dangerous:
        if keyword in sql.upper():
            return False
    if 'SELECT' not in sql.upper():
        return False
    return True

def execute_query(csv_data: str, sql: str, col_types: dict) -> dict:
    import sqlite3
    import io
    import csv

    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()

    reader = csv.DictReader(io.StringIO(csv_data))
    rows = list(reader)

    if not rows:
        raise Exception("No data")

    cols = list(rows[0].keys())
    
    # Create table with inferred types
    col_defs = []
    for col in cols:
        dtype = col_types.get(col.strip(), "TEXT")
        col_defs.append(f'"{col}" {dtype}')
    
    cursor.execute(f"CREATE TABLE data ({', '.join(col_defs)})")

    placeholders = ', '.join(['?' for _ in cols])
    for row in rows:
        values = [row.get(c, '') for c in cols]
        cursor.execute(f"INSERT INTO data VALUES ({placeholders})", values)

    conn.commit()

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

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024,
            temperature=0,
        )

        generated_sql = response.choices[0].message.content.strip()
        generated_sql = generated_sql.replace('```sql', '').replace('```', '').strip()

        if not validate_sql(generated_sql):
            raise HTTPException(status_code=400, detail="Generated SQL contains unsafe operations")

        result = execute_query(file.csv_data, generated_sql, col_types)

        history = QueryHistory(
            user_id=user.id,
            file_id=request.file_id,
            question=request.question,
            generated_sql=generated_sql,
            results=json.dumps(result)
        )
        db.add(history)
        db.commit()

        return {
            "question": request.question,
            "sql": generated_sql,
            "data": result,
            "row_count": result["count"]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")