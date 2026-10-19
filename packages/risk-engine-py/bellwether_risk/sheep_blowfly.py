from .dates import days_between
from .levels import LEVEL_SCORE, raise_level
from .types import DailyRisk, DailyWeather, GroupContext, RiskLevel

# Heuristic thresholds. Blowfly strike risk rises in warm, humid weather,
# especially after rain.
# heuristic TODO(verify source): check against UK sheep health / flystrike guidance.
BLOWFLY_COLD_MEAN_C = 9
BLOWFLY_WARM_MEAN_C = 15
BLOWFLY_HUMID_PCT = 70
BLOWFLY_RAIN_MM = 2
# Fleece regrowth after which shorn sheep are treated as unshorn again (~6 weeks).
# heuristic TODO(verify source)
BLOWFLY_FLEECE_DAYS = 42


def _fleece_note(date: str, group: GroupContext | None) -> str | None:
    """Why a flock's fleece raises the risk on this day, or None if it doesn't."""
    if group is None or group.species != "sheep":
        return None
    if not group.last_shearing_date:
        return "no shearing date is recorded"
    days = days_between(group.last_shearing_date, date)
    return f"the flock was shorn {days} days ago" if days > BLOWFLY_FLEECE_DAYS else None


def _assess_day(
    day: DailyWeather, previous: DailyWeather | None, group: GroupContext | None
) -> DailyRisk:
    if day.temp_mean_c < BLOWFLY_COLD_MEAN_C:
        return DailyRisk(day.date, "LOW", LEVEL_SCORE["LOW"], "Too cool for much blowfly activity")

    level: RiskLevel
    if day.temp_mean_c >= BLOWFLY_WARM_MEAN_C and day.humidity_mean_pct >= BLOWFLY_HUMID_PCT:
        level, reason = "HIGH", "Warm and humid: blowfly strike risk high"
    else:
        level, reason = "MEDIUM", "Mild conditions: some blowfly activity possible"

    if previous and previous.precipitation_mm >= BLOWFLY_RAIN_MM and level != "HIGH":
        level = raise_level(level)
        reason += "; raised because of rain the day before"

    fleece = _fleece_note(day.date, group)
    if fleece and level != "HIGH":
        level = raise_level(level)
        reason += f"; raised because {fleece}"

    return DailyRisk(day.date, level, LEVEL_SCORE[level], reason)


def assess_sheep_blowfly(
    days: list[DailyWeather], group: GroupContext | None = None
) -> list[DailyRisk]:
    return [_assess_day(day, days[i - 1] if i > 0 else None, group) for i, day in enumerate(days)]
