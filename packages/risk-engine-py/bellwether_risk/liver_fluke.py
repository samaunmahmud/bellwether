import calendar
from dataclasses import dataclass, field

from .dates import add_days
from .levels import clamp_score, js_round
from .types import DailyRisk, DailyWeather, DateRange, RiskLevel

# Liver fluke season risk, using the Ollerenshaw index.
# For each month of the May–October season:   Mt = n × (R − P + 5)
# n = rain days, R = rainfall, P = potential evapotranspiration, R and P in inches
# (Ollerenshaw & Rowlands, Veterinary Record, 1959). Each month is capped and the
# monthly values are summed into a season index. Caps and bands follow Met Éireann's
# operational version and Fox et al. 2011 (PLoS ONE).
# TODO(verify source): the equation was read from secondary sources, not the 1959 paper.
FLUKE_RAIN_DAY_MM = 0.2  # heuristic TODO(verify source)
_MM_PER_INCH = 25.4
FLUKE_CONSTANT = 5  # heuristic TODO(verify source)
FLUKE_MONTH_CAP = 100  # heuristic TODO(verify source)
# May and October are cooler, so snail development is slower.
FLUKE_SHOULDER_MONTH_CAP = 50  # heuristic TODO(verify source)
_SEASON_FIRST_MONTH = 5  # May
_SEASON_LAST_MONTH = 10  # October
_SHOULDER_MONTHS = (5, 10)
# Bands for the season total. heuristic TODO(verify source)
FLUKE_MEDIUM = 300
FLUKE_HIGH = 400  # HIGH when above this
# The largest possible season total (50 + 4 × 100 + 50), used for the chart score.
_FLUKE_SEASON_MAX = 500

_OUTCOME: dict[RiskLevel, str] = {
    "LOW": "low fluke risk",
    "MEDIUM": "moderate fluke risk",
    "HIGH": "high fluke risk",
}


def monthly_fluke_value(month: int, rain_days: int, rain_mm: float, pet_mm: float) -> float:
    cap = FLUKE_SHOULDER_MONTH_CAP if month in _SHOULDER_MONTHS else FLUKE_MONTH_CAP
    value = rain_days * ((rain_mm - pet_mm) / _MM_PER_INCH + FLUKE_CONSTANT)
    return min(cap, max(0, value))


def fluke_level(index: float) -> RiskLevel:
    if index < FLUKE_MEDIUM:
        return "LOW"
    return "MEDIUM" if index <= FLUKE_HIGH else "HIGH"


def fluke_season_year(date: str) -> int:
    """The season that matters on a date: this year's once May is complete, else last year's."""
    year, month = int(date[:4]), int(date[5:7])
    return year if month > _SEASON_FIRST_MONTH else year - 1


@dataclass
class SeasonIndex:
    index: float = 0
    months: list[str] = field(default_factory=list)  # complete season months, e.g. ["May"]
    complete: bool = False
    rain_days: int = 0
    rain_mm: float = 0
    pet_mm: float = 0


def season_fluke_index(history: list[DailyWeather], year: int) -> SeasonIndex:
    """Sums the monthly values for the complete May–October months of `year` in `history`."""
    result = SeasonIndex()
    for month in range(_SEASON_FIRST_MONTH, _SEASON_LAST_MONTH + 1):
        prefix = f"{year}-{month:02d}-"
        days = [d for d in history if d.date.startswith(prefix) and d.et0_mm is not None]
        if len(days) < calendar.monthrange(year, month)[1]:
            continue
        rain_days = sum(1 for d in days if d.precipitation_mm >= FLUKE_RAIN_DAY_MM)
        rain_mm = sum(d.precipitation_mm for d in days)
        pet_mm = sum(d.et0_mm or 0 for d in days)
        result.index += monthly_fluke_value(month, rain_days, rain_mm, pet_mm)
        result.months.append(calendar.month_abbr[month])
        result.rain_days += rain_days
        result.rain_mm += rain_mm
        result.pet_mm += pet_mm
    result.complete = len(result.months) == _SEASON_LAST_MONTH - _SEASON_FIRST_MONTH + 1
    return result


def _season_for(days: list[DailyWeather], history: list[DailyWeather]) -> SeasonIndex | None:
    if not days or not history:
        return None
    season = season_fluke_index(history, fluke_season_year(days[0].date))
    return season if season.months else None


def _describe(season: SeasonIndex, year: int) -> tuple[RiskLevel, str]:
    level = fluke_level(season.index)
    first, last = season.months[0], season.months[-1]
    span = first if first == last else f"{first}–{last}"
    so_far = "" if season.complete else " so far"
    reason = (
        f"Fluke season index {js_round(season.index)} from {span} {year} weather{so_far} "
        f"({js_round(season.rain_mm)} mm rain on {season.rain_days} days, "
        f"{js_round(season.pet_mm)} mm evaporation): "
        f"{_OUTCOME[level]}{so_far} this season"
    )
    return level, reason


def assess_liver_fluke(
    days: list[DailyWeather], history: list[DailyWeather] | None = None
) -> list[DailyRisk]:
    """Season-level: every forecast day gets the same result."""
    season = _season_for(days, history or [])
    if season is None:
        level: RiskLevel = "LOW"
        reason = "Not enough past weather to estimate the fluke season"
        score = 0
    else:
        level, reason = _describe(season, fluke_season_year(days[0].date))
        score = clamp_score(season.index / _FLUKE_SEASON_MAX * 100)
    return [DailyRisk(day.date, level, score, reason) for day in days]


def liver_fluke_applies(history: list[DailyWeather] | None, days: list[DailyWeather]) -> bool:
    return _season_for(days, history or []) is not None


def liver_fluke_history_range(first_forecast_day: str) -> DateRange:
    """The past weather needed: May of the relevant season up to the day before the forecast."""
    year = fluke_season_year(first_forecast_day)
    season_end = f"{year}-{_SEASON_LAST_MONTH}-31"
    day_before = add_days(first_forecast_day, -1)
    return DateRange(f"{year}-0{_SEASON_FIRST_MONTH}-01", min(day_before, season_end))
