import math
from decimal import ROUND_HALF_UP, Decimal

from .types import RiskLevel

_ORDER: list[RiskLevel] = ["LOW", "MEDIUM", "HIGH"]

# Default chart score for each level, used by modules without a continuous score.
LEVEL_SCORE: dict[RiskLevel, int] = {"LOW": 15, "MEDIUM": 50, "HIGH": 85}


def raise_level(level: RiskLevel) -> RiskLevel:
    """Raise a risk level by one step, capped at HIGH."""
    return _ORDER[min(_ORDER.index(level) + 1, len(_ORDER) - 1)]


def js_round(value: float) -> int:
    """JavaScript's Math.round (Python's round() rounds half to even)."""
    return math.floor(value + 0.5)


def clamp_score(value: float) -> int:
    return max(0, min(100, js_round(value)))


def to_fixed(value: float, digits: int) -> str:
    """JavaScript's Number.toFixed: rounds half away from zero on the exact float value."""
    return str(Decimal(value).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP))
