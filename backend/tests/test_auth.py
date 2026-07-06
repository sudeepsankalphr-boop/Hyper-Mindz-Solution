import os
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest")
os.environ.setdefault("GROQ_API_KEY", "dummy")

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

EMAIL = "pytest_user@test.com"
PASSWORD = "testpass123"


def test_signup():
    res = client.post("/auth/signup", json={"email": EMAIL, "password": PASSWORD})
    # 200 on first run, 400 if already exists from a previous run — both are acceptable
    assert res.status_code in (200, 400)
    if res.status_code == 200:
        assert "access_token" in res.json()


def test_login_success():
    client.post("/auth/signup", json={"email": EMAIL, "password": PASSWORD})
    res = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "user_id" in data
    assert data["email"] == EMAIL


def test_login_wrong_password():
    res = client.post("/auth/login", json={"email": EMAIL, "password": "wrongpass"})
    assert res.status_code == 401


def test_login_nonexistent_user():
    res = client.post("/auth/login", json={"email": "nobody@test.com", "password": "pass"})
    assert res.status_code == 401


def test_duplicate_signup():
    client.post("/auth/signup", json={"email": EMAIL, "password": PASSWORD})
    res = client.post("/auth/signup", json={"email": EMAIL, "password": PASSWORD})
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]
