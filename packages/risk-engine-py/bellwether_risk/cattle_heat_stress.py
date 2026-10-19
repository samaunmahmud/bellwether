from .levels import clamp_score, to_fixed
from .types import DailyRisk, DailyWeather, RiskLevel

# Band thresholds vary in the literature (dairy cattle are often given lower ones).
# heuristic TODO(verify source): confirm which THI bands to use and cite them in the README.
THI_MEDIUM = 68
THI_HIGH = 72

# Range used to map THI onto the 0–100 chart score.
_THI_SCORE_MIN = 55
_THI_SCORE_MAX = 85

_OUTCOME: dict[RiskLevel, str] = {
    "LOW": "heat stress unlikely",
    "MEDIUM": "mild heat stress possible",
    "HIGH": "heat stress likely",
}


def calculate_thi(temp_c: float, humidity_pct: float) -> float:
    """Temperature-Humidity Index: (1.8T + 32) - (0.55 - 0.0055RH)(1.8T - 26), T in °C, RH in %."""
    return 1.8 * temp_c + 32 - (0.55 - 0.0055 * humidity_pct) * (1.8 * temp_c - 26)


def _level_for(thi: float) -> RiskLevel:
    if thi < THI_MEDIUM:
        return "LOW"
    return "MEDIUM" if thi < THI_HIGH else "HIGH"


def _assess_day(day: DailyWeather) -> DailyRisk:
    """Daily maximum temperature with mean humidity (the TS engine also has an hourly path)."""
    thi = calculate_thi(day.temp_max_c, day.humidity_mean_pct)
    level = _level_for(thi)
    score = clamp_score((thi - _THI_SCORE_MIN) / (_THI_SCORE_MAX - _THI_SCORE_MIN) * 100)
    return DailyRisk(day.date, level, score, f"THI {to_fixed(thi, 1)}: {_OUTCOME[level]}")


def assess_cattle_heat_stress(days: list[DailyWeather]) -> list[DailyRisk]:
    return [_assess_day(day) for day in days]
