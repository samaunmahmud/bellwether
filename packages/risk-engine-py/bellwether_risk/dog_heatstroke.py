from .levels import LEVEL_SCORE
from .types import DailyRisk, DailyWeather

# Heuristic thresholds based on the day's maximum temperature.
# heuristic TODO(verify source): check against UK veterinary guidance on dogs in hot weather.
HEATSTROKE_MEDIUM_MAX_C = 20
HEATSTROKE_HIGH_MAX_C = 25


def _assess_day(day: DailyWeather) -> DailyRisk:
    if day.temp_max_c < HEATSTROKE_MEDIUM_MAX_C:
        return DailyRisk(day.date, "LOW", LEVEL_SCORE["LOW"], "Cool enough for normal walks")
    if day.temp_max_c <= HEATSTROKE_HIGH_MAX_C:
        return DailyRisk(
            day.date, "MEDIUM", LEVEL_SCORE["MEDIUM"], "Warm day: consider walking in cooler hours"
        )
    return DailyRisk(
        day.date,
        "HIGH",
        LEVEL_SCORE["HIGH"],
        "Hot day: walk early morning or evening and keep exercise light",
    )


def assess_dog_heatstroke(days: list[DailyWeather]) -> list[DailyRisk]:
    return [_assess_day(day) for day in days]
