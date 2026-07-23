import os
import httpx
from fastapi import HTTPException

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:8000")
_TIMEOUT = 5.0


def check_with_gateway(sql: str, target: str = "database") -> None:
    """
    Submit a SQL query to the action gateway for policy evaluation.
    Raises HTTPException if the query is blocked or the gateway is unreachable.
    """
    payload = {
        "agent_id": "hypermindz-nl-sql",
        "action_type": "execute_query",
        "target": target,
        "params": {"sql": sql},
    }

    try:
        response = httpx.post(
            f"{GATEWAY_URL}/actions",
            json=payload,
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="Query gateway is unreachable. Query execution blocked.",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Query gateway returned an unexpected error ({e.response.status_code}). Query execution blocked.",
        )

    decision = data.get("decision")
    reason = data.get("reason", "")
    correlation_id = data.get("correlation_id", "")

    if decision == "APPROVED":
        return

    if decision == "REJECTED":
        raise HTTPException(
            status_code=403,
            detail=f"Query rejected by policy: {reason}",
        )

    if decision == "NEEDS_APPROVAL":
        raise HTTPException(
            status_code=403,
            detail=f"Query requires human approval: {reason} (correlation_id: {correlation_id})",
        )

    # Unknown decision — fail closed
    raise HTTPException(
        status_code=503,
        detail=f"Query gateway returned unrecognised decision '{decision}'. Query execution blocked.",
    )
