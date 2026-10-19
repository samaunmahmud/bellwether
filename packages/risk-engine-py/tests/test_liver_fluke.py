import calendar
from dataclasses import replace

import pytest

from bellwether_risk import (
    DailyWeather,
    DateRange,
    assess_liver_fluke,
    fluke_level,
    fluke_season_year,
    liver_fluke_applies,
    liver_fluke_history_range,
    monthly_fluke_value,
    season_fluke_index,
)
from helpers import day

WET = {"rain_days": 15, "rain_mm": 100, "pet_mm": 50}  # capped at 100 (50 in May/Oct)
MIXED = {"rain_days": 10, "rain_mm": 60, "pet_mm": 85}  # ≈ 40.16


def month(year_month: str, rain_days: int, rain_mm: float, pet_mm: float) -> list[DailyWeather]:
    """Every day of a month, with rain on the first `rain_days` days, totalling the amounts."""
    length = calendar.monthrange(int(year_month[:4]), int(year_month[5:]))[1]
    return [
        day(
            date=f"{year_month}-{i + 1:02d}",
            precipitation_mm=rain_mm / rain_days if i < rain_days else 0,
            et0_mm=pet_mm / length,
        )
        for i in range(length)
    ]


def full_season(year: int) -> list[DailyWeather]:
    return [d for m in range(5, 11) for d in month(f"{year}-{m:02d}", **WET)]


def test_monthly_value_hand_worked() -> None:
    # 10 × (−25/25.4 + 5) ≈ 40.157
    assert monthly_fluke_value(7, **MIXED) == pytest.approx(40.157, abs=0.001)


def test_monthly_value_caps_and_floor() -> None:
    assert monthly_fluke_value(7, **WET) == 100
    assert monthly_fluke_value(5, **WET) == 50
    assert monthly_fluke_value(10, **WET) == 50
    assert monthly_fluke_value(7, rain_days=5, rain_mm=10, pet_mm=200) == 0


@pytest.mark.parametrize(
    ("index", "expected"),
    [(299.9, "LOW"), (300, "MEDIUM"), (400, "MEDIUM"), (400.1, "HIGH")],
)
def test_bands(index: float, expected: str) -> None:
    assert fluke_level(index) == expected


def test_season_year_switches_once_may_is_complete() -> None:
    assert fluke_season_year("2026-06-01") == 2026
    assert fluke_season_year("2026-05-31") == 2025


def test_history_range() -> None:
    assert liver_fluke_history_range("2026-08-15") == DateRange("2026-05-01", "2026-08-14")
    assert liver_fluke_history_range("2026-02-01") == DateRange("2025-05-01", "2025-10-31")


def test_season_index_sums_complete_months_only() -> None:
    history = [
        *month("2026-05", **WET),
        *month("2026-06", **WET),
        *month("2026-07", **MIXED),
        *month("2026-08", **WET)[:20],  # incomplete: ignored
    ]
    result = season_fluke_index(history, 2026)
    assert result.index == pytest.approx(190.157, abs=0.001)
    assert result.months == ["May", "Jun", "Jul"]
    assert not result.complete
    assert result.rain_days == 40


def test_month_with_missing_evaporation_is_incomplete() -> None:
    june = month("2026-06", **WET)
    june[3] = replace(june[3], et0_mm=None)
    assert season_fluke_index(june, 2026).months == []


def test_full_season_is_complete_and_high() -> None:
    assert season_fluke_index(full_season(2025), 2025).complete
    [result] = assess_liver_fluke([day(date="2026-01-10")], full_season(2025))
    assert result.level == "HIGH"
    assert result.reason.startswith("Fluke season index 500 from May–Oct 2025 weather (")


def test_every_day_gets_the_same_season_result() -> None:
    history = [*month("2026-05", **WET), *month("2026-06", **WET), *month("2026-07", **WET)]
    results = assess_liver_fluke([day(date="2026-08-15"), day(date="2026-08-16")], history)
    assert results[0].reason == (
        "Fluke season index 250 from May–Jul 2026 weather so far "
        "(300 mm rain on 45 days, 150 mm evaporation): low fluke risk so far this season"
    )
    assert replace(results[1], date="2026-08-15") == results[0]


def test_not_enough_history() -> None:
    [result] = assess_liver_fluke([day(date="2026-08-15")])
    assert result.reason == "Not enough past weather to estimate the fluke season"
    assert assess_liver_fluke([], []) == []
    assert not liver_fluke_applies(month("2026-05", **WET)[:20], [day(date="2026-08-15")])
    assert liver_fluke_applies(month("2026-05", **WET), [day(date="2026-08-15")])
