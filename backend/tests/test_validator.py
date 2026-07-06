import pytest
from query import validate_sql


def test_basic_select():
    ok, _ = validate_sql("SELECT * FROM data")
    assert ok


def test_select_with_where():
    ok, _ = validate_sql("SELECT id, name FROM data WHERE revenue > 100")
    assert ok


def test_select_with_aggregation():
    ok, _ = validate_sql("SELECT category, SUM(revenue) FROM data GROUP BY category")
    assert ok


def test_subquery_allowed():
    ok, _ = validate_sql(
        "SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY region ORDER BY revenue DESC) AS rn FROM data) WHERE rn = 1"
    )
    assert ok


def test_drop_blocked():
    ok, reason = validate_sql("DROP TABLE data")
    assert not ok
    assert reason  # blocked either by non-SELECT check or keyword check


def test_delete_blocked():
    ok, _ = validate_sql("DELETE FROM data WHERE id=1")
    assert not ok


def test_update_blocked():
    ok, _ = validate_sql("UPDATE data SET col=1")
    assert not ok


def test_insert_blocked():
    ok, _ = validate_sql("INSERT INTO data VALUES (1)")
    assert not ok


def test_stacked_statements_blocked():
    ok, _ = validate_sql("SELECT * FROM data; DROP TABLE data")
    assert not ok


def test_truncate_blocked():
    ok, _ = validate_sql("TRUNCATE TABLE data")
    assert not ok


def test_attach_blocked():
    ok, _ = validate_sql("ATTACH DATABASE 'other.db' AS other")
    assert not ok


def test_column_named_created_at_allowed():
    # 'created_at' contains 'CREATE' as substring — word-boundary check must not false-positive
    ok, _ = validate_sql("SELECT created_at FROM data")
    assert ok


def test_column_named_updated_date_allowed():
    ok, _ = validate_sql("SELECT updated_date FROM data WHERE updated_date > '2024-01-01'")
    assert ok
