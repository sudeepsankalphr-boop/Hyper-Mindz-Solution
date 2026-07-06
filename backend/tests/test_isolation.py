import os
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest")
os.environ.setdefault("GROQ_API_KEY", "dummy")

import io
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

SAMPLE_CSV = "id,name,revenue\n1,Alice,100\n2,Bob,200\n"


def _signup_and_token(email: str, password: str = "pass123") -> str:
    client.post("/auth/signup", json={"email": email, "password": password})
    res = client.post("/auth/login", json={"email": email, "password": password})
    return res.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_files_list_requires_auth():
    res = client.get("/files/list")
    assert res.status_code == 401


def test_upload_and_list():
    token = _signup_and_token("isolation_user1@test.com")
    res = client.post(
        "/files/upload",
        files={"file": ("data.csv", io.BytesIO(SAMPLE_CSV.encode()), "text/csv")},
        headers=_auth(token),
    )
    assert res.status_code == 200
    assert "file_id" in res.json()

    list_res = client.get("/files/list", headers=_auth(token))
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1


def test_user_cannot_access_other_users_file():
    token1 = _signup_and_token("isolation_owner@test.com")
    token2 = _signup_and_token("isolation_attacker@test.com")

    # user1 uploads a file
    upload_res = client.post(
        "/files/upload",
        files={"file": ("secret.csv", io.BytesIO(SAMPLE_CSV.encode()), "text/csv")},
        headers=_auth(token1),
    )
    file_id = upload_res.json()["file_id"]

    # user2 tries to fetch it
    res = client.get(f"/files/{file_id}", headers=_auth(token2))
    assert res.status_code == 404


def test_user_cannot_delete_other_users_file():
    token1 = _signup_and_token("isolation_owner2@test.com")
    token2 = _signup_and_token("isolation_attacker2@test.com")

    upload_res = client.post(
        "/files/upload",
        files={"file": ("secret2.csv", io.BytesIO(SAMPLE_CSV.encode()), "text/csv")},
        headers=_auth(token1),
    )
    file_id = upload_res.json()["file_id"]

    res = client.delete(f"/files/{file_id}", headers=_auth(token2))
    assert res.status_code == 404
