from datetime import date, timedelta


def days_between(start: str, end: str) -> int:
    """Whole days from `start` to `end` (ISO dates). Positive when `end` is later."""
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def add_days(iso: str, days: int) -> str:
    """The ISO date `days` after `iso` (negative for earlier)."""
    return (date.fromisoformat(iso) + timedelta(days=days)).isoformat()
