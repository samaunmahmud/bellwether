import math

from .dates import add_days
from .levels import LEVEL_SCORE, clamp_score, js_round, to_fixed
from .types import DailyRisk, DailyWeather, DateRange, GroupContext, RiskLevel

# Newborn lamb chill index (potential heat loss, kJ/m²/h):
#   C = (11.7 + 3.1·√v)(40 − T) + 481 + 418·(1 − e^(−0.04·R))
# v = wind speed (m/s), T = mean air temperature (°C), R = daily rainfall (mm).
# Secondary sources attribute this to Nixon-Smith (1972), applied to newborn lambs by
# Donnelly (1984). TODO(verify source): check the formula against the original papers.
# Open-Meteo's 10 m wind is used unadjusted, which will tend to overstate chill.
_CHILL_BASE_COEFF = 11.7  # heuristic TODO(verify source)
_CHILL_WIND_COEFF = 3.1  # heuristic TODO(verify source)
_CHILL_REFERENCE_C = 40  # heuristic TODO(verify source)
_CHILL_CONSTANT = 481  # heuristic TODO(verify source)
_CHILL_RAIN_MAX = 418  # heuristic TODO(verify source)
_CHILL_RAIN_RATE = 0.04  # heuristic TODO(verify source)

# Bands. heuristic TODO(verify source): confirm both band edges.
CHILL_MEDIUM = 1000
CHILL_HIGH = 1100

# Lambs count as newborn for this many days after the last lambing date.
NEWBORN_DAYS = 3  # heuristic TODO(verify source)

# Range used to map the index onto the 0–100 chart score.
_CHILL_SCORE_MIN = 800
_CHILL_SCORE_MAX = 1300

_OUTCOME: dict[RiskLevel, str] = {
    "LOW": "low chill risk for newborn lambs",
    "MEDIUM": "some chill risk for newborn lambs",
    "HIGH": "newborn lambs at high risk of chilling",
}


def calculate_chill_index(temp_c: float, wind_ms: float, rain_mm: float) -> float:
    return (
        (_CHILL_BASE_COEFF + _CHILL_WIND_COEFF * math.sqrt(max(0, wind_ms)))
        * (_CHILL_REFERENCE_C - temp_c)
        + _CHILL_CONSTANT
        + _CHILL_RAIN_MAX * (1 - math.exp(-_CHILL_RAIN_RATE * max(0, rain_mm)))
    )


def chill_level(index: float) -> RiskLevel:
    if index < CHILL_MEDIUM:
        return "LOW"
    return "MEDIUM" if index < CHILL_HIGH else "HIGH"


def _newborn_window(group: GroupContext | None) -> DateRange | None:
    """The days on which newborn lambs may be outside: lambing start to end + NEWBORN_DAYS."""
    if group is None or not group.lambing_start or not group.lambing_end:
        return None
    return DateRange(group.lambing_start, add_days(group.lambing_end, NEWBORN_DAYS))


def _assess_day(day: DailyWeather, group: GroupContext | None) -> DailyRisk:
    window = _newborn_window(group)
    if window and not window.start <= day.date <= window.end:
        return DailyRisk(day.date, "LOW", LEVEL_SCORE["LOW"], "Outside the lambing period")

    wind_ms = day.wind_speed_mean_ms or 0
    index = calculate_chill_index(day.temp_mean_c, wind_ms, day.precipitation_mm)
    level = chill_level(index)
    wind = "no wind data" if day.wind_speed_mean_ms is None else f"wind {to_fixed(wind_ms, 1)} m/s"

    reason = (
        f"Chill index {js_round(index)} kJ/m²/h "
        f"({to_fixed(day.temp_mean_c, 1)}°C, {wind}, {to_fixed(day.precipitation_mm, 1)} mm rain): "
        f"{_OUTCOME[level]}"
    )
    if group and group.housed:
        reason += " (housed: lambs indoors are more sheltered than this)"

    score = clamp_score((index - _CHILL_SCORE_MIN) / (_CHILL_SCORE_MAX - _CHILL_SCORE_MIN) * 100)
    return DailyRisk(day.date, level, score, reason)


def assess_lamb_chill(days: list[DailyWeather], group: GroupContext | None = None) -> list[DailyRisk]:
    return [_assess_day(day, group) for day in days]


def lamb_chill_applies(group: GroupContext | None, days: list[DailyWeather]) -> bool:
    """Only for sheep whose lambing (plus the newborn days) overlaps the forecast."""
    window = _newborn_window(group)
    if group is None or group.species != "sheep" or window is None or not days:
        return False
    return window.start <= days[-1].date and window.end >= days[0].date
