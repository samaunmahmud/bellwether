from .levels import LEVEL_SCORE, raise_level
from .types import DailyRisk, DailyWeather, RiskLevel

# Heuristic thresholds. Ticks are most active in mild, humid conditions and
# quieter when cold, or when hot and dry.
# heuristic TODO(verify source): check these against UK veterinary / parasitology guidance.
TICK_COLD_MEAN_C = 5
TICK_ACTIVE_MEAN_C = 7
TICK_HUMID_PCT = 80
TICK_HOT_MAX_C = 28
TICK_DRY_PCT = 60


def _assess_day(day: DailyWeather, high_exposure_habitat: bool) -> DailyRisk:
    level: RiskLevel
    if day.temp_mean_c < TICK_COLD_MEAN_C:
        level, reason = "LOW", "Too cold for much tick activity"
    elif day.temp_max_c >= TICK_HOT_MAX_C and day.humidity_mean_pct < TICK_DRY_PCT:
        level, reason = "LOW", "Hot and dry: ticks less active"
    elif day.temp_mean_c >= TICK_ACTIVE_MEAN_C and day.humidity_mean_pct >= TICK_HUMID_PCT:
        level, reason = "HIGH", "Mild and humid: ticks likely active"
    else:
        level, reason = "MEDIUM", "Some tick activity possible"

    if high_exposure_habitat and level != "HIGH":
        level = raise_level(level)
        reason += "; raised because of walks in long grass or woodland"

    return DailyRisk(day.date, level, LEVEL_SCORE[level], reason)


def assess_tick(days: list[DailyWeather], high_exposure_habitat: bool = False) -> list[DailyRisk]:
    return [_assess_day(day, high_exposure_habitat) for day in days]
