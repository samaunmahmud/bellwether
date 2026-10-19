from dataclasses import dataclass
from typing import Literal

RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]


@dataclass(frozen=True)
class DailyWeather:
    date: str  # ISO date, e.g. "2026-10-15"
    temp_mean_c: float
    temp_max_c: float
    temp_min_c: float
    humidity_mean_pct: float
    precipitation_mm: float
    # Optional extras. Modules must still work when they are missing.
    wind_speed_mean_ms: float | None = None  # mean wind speed at 10 m, m/s
    et0_mm: float | None = None  # FAO reference evapotranspiration, mm/day


Species = Literal["cattle", "sheep"]


@dataclass(frozen=True)
class GroupContext:
    """What we know about a livestock group. Dates are ISO (YYYY-MM-DD)."""

    species: Species
    housed: bool = False
    last_shearing_date: str | None = None
    lambing_start: str | None = None
    lambing_end: str | None = None


@dataclass(frozen=True)
class DateRange:
    """Inclusive ISO dates."""

    start: str
    end: str


@dataclass(frozen=True)
class DailyRisk:
    date: str
    level: RiskLevel
    score: int  # 0–100, used for charts
    reason: str
