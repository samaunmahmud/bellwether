import re

import pytest

from bellwether_risk import (
    GroupContext,
    assess_lamb_chill,
    calculate_chill_index,
    chill_level,
    lamb_chill_applies,
)
from helpers import day


def lambing(start: str, end: str, housed: bool = False) -> GroupContext:
    return GroupContext(species="sheep", lambing_start=start, lambing_end=end, housed=housed)


MARCH = lambing("2026-03-01", "2026-03-31")
COLD_WET = {"date": "2026-03-10", "temp_mean_c": 2, "wind_speed_mean_ms": 6, "precipitation_mm": 8}


@pytest.mark.parametrize(
    ("temp", "wind", "rain", "expected"),
    [
        (10, 0, 0, 832),  # 11.7 × 30 + 481
        (5, 4, 0, 1107.5),  # (11.7 + 6.2) × 35 + 481
        (0, 1, 10, 1210.81),  # 14.8 × 40 + 481 + 418(1 − e^−0.4)
    ],
)
def test_chill_index_hand_worked(temp: float, wind: float, rain: float, expected: float) -> None:
    assert calculate_chill_index(temp, wind, rain) == pytest.approx(expected, abs=0.005)


@pytest.mark.parametrize(
    ("index", "expected"),
    [(999.9, "LOW"), (1000, "MEDIUM"), (1099.9, "MEDIUM"), (1100, "HIGH")],
)
def test_chill_bands(index: float, expected: str) -> None:
    assert chill_level(index) == expected


def test_reason_names_the_weather() -> None:
    [result] = assess_lamb_chill([day(**COLD_WET)], MARCH)
    assert result.level == "HIGH"
    assert re.fullmatch(
        r"Chill index \d+ kJ/m²/h \(2\.0°C, wind 6\.0 m/s, 8\.0 mm rain\): "
        r"newborn lambs at high risk of chilling",
        result.reason,
    )


def test_low_outside_lambing_including_3_days_after() -> None:
    dates = ["2026-02-28", "2026-03-01", "2026-03-31", "2026-04-03", "2026-04-04"]
    results = assess_lamb_chill([day(**{**COLD_WET, "date": d}) for d in dates], MARCH)
    assert [r.level for r in results] == ["LOW", "HIGH", "HIGH", "HIGH", "LOW"]


def test_notes_missing_wind_and_housing() -> None:
    assert "no wind data" in assess_lamb_chill([day(date="2026-03-10", temp_mean_c=2)], MARCH)[0].reason
    housed = lambing("2026-03-01", "2026-03-31", housed=True)
    assert "housed" in assess_lamb_chill([day(**COLD_WET)], housed)[0].reason


def test_applies_only_when_lambing_overlaps_the_forecast() -> None:
    forecast = [day(date="2026-03-10"), day(date="2026-03-23")]
    assert lamb_chill_applies(lambing("2026-03-20", "2026-04-10"), forecast)
    assert lamb_chill_applies(lambing("2026-02-01", "2026-03-07"), forecast)  # newborns still out
    assert not lamb_chill_applies(lambing("2026-04-01", "2026-04-30"), forecast)
    assert not lamb_chill_applies(lambing("2026-02-01", "2026-03-06"), forecast)
    assert not lamb_chill_applies(GroupContext(species="sheep"), forecast)
    cattle = GroupContext(species="cattle", lambing_start="2026-03-01", lambing_end="2026-03-31")
    assert not lamb_chill_applies(cattle, forecast)
