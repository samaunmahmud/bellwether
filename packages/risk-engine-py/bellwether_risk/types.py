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


@dataclass(frozen=True)
class DailyRisk:
    date: str
    level: RiskLevel
    score: int  # 0–100, used for charts
    reason: str
