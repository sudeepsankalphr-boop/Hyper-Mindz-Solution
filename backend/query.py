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

def build_prompt(schema: str, question: str, sample_rows: str) -> str:
    return f"""You are a SQL expert. Generate a SQLite SELECT query for this question.

CSV Schema (columns):
{schema}

Sample data (first 3 rows):
{sample_rows}

Question: {question}

Rules:
1. Generate ONLY the SELECT statement
2. No explanations, no markdown, no backticks
3. Use standard SQLite syntax
4. Column names must match exactly
5. Table name is always: data

Return ONLY the SQL query, nothing else."""

def validate_sql(sql: str) -> bool:
    dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE']
    for keyword in dangerous:
        if keyword in sql.upper():
            return False
    if 'SELECT' not in sql.upper():
        return False
    return True

def execute_query(csv_data: str, sql: str) -> dict:
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
    col_defs = ', '.join([f'"{c}" TEXT' for c in cols])
    cursor.execute(f"CREATE TABLE data ({col_defs})")

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
    sample_lines = file.csv_data.split('\n')[:4]
    sample_rows = '\n'.join(sample_lines)
    prompt = build_prompt(schema, request.question, sample_rows)

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

        result = execute_query(file.csv_data, generated_sql)

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