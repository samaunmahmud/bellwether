from dataclasses import replace
from typing import Any

from bellwether_risk import DailyWeather

_DEFAULT = DailyWeather(
    date="2026-06-01",
    temp_mean_c=12,
    temp_max_c=16,
    temp_min_c=8,
    humidity_mean_pct=70,
    precipitation_mm=0,
)


def day(**overrides: Any) -> DailyWeather:
    """A day of weather with sensible defaults, overriding only what a test cares about."""
    return replace(_DEFAULT, **overrides)
