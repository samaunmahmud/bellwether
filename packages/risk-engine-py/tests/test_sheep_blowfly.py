import pytest

from bellwether_risk import GroupContext, assess_sheep_blowfly
from helpers import day

# A mild day that is MEDIUM on weather alone.
MILD = {"date": "2026-07-01", "temp_mean_c": 12, "humidity_mean_pct": 50}


def sheep(last_shearing_date: str | None) -> GroupContext:
    return GroupContext(species="sheep", last_shearing_date=last_shearing_date)


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"temp_mean_c": 8.9}, "LOW"),  # just below cold
        ({"temp_mean_c": 9, "humidity_mean_pct": 50}, "MEDIUM"),  # on cold
        ({"temp_mean_c": 15, "humidity_mean_pct": 70}, "HIGH"),  # on warm and humid
        ({"temp_mean_c": 14.9, "humidity_mean_pct": 90}, "MEDIUM"),
        ({"temp_mean_c": 18, "humidity_mean_pct": 69.9}, "MEDIUM"),
    ],
)
def test_weather_boundaries(overrides: dict[str, float], expected: str) -> None:
    assert assess_sheep_blowfly([day(**overrides)])[0].level == expected


def test_rain_the_day_before_raises_and_explains() -> None:
    _, today = assess_sheep_blowfly([day(precipitation_mm=2), day(**MILD)])
    assert today.level == "HIGH"
    assert "rain the day before" in today.reason


def test_rain_just_under_2mm_does_not_raise() -> None:
    assert assess_sheep_blowfly([day(precipitation_mm=1.9), day(**MILD)])[1].level == "MEDIUM"


def test_rain_does_not_raise_a_cold_day_or_add_a_note_to_high() -> None:
    assert assess_sheep_blowfly([day(precipitation_mm=10), day(temp_mean_c=5)])[1].level == "LOW"
    _, hot = assess_sheep_blowfly(
        [day(precipitation_mm=10), day(temp_mean_c=18, humidity_mean_pct=80)]
    )
    assert hot.level == "HIGH"
    assert "rain" not in hot.reason


def test_first_day_is_never_raised_for_rain() -> None:
    assert assess_sheep_blowfly([day(**MILD, precipitation_mm=20)])[0].level == "MEDIUM"


@pytest.mark.parametrize(
    ("shorn", "expected"),
    [("2026-05-21", "MEDIUM"), ("2026-05-20", "MEDIUM"), ("2026-05-19", "HIGH")],  # 41, 42, 43 days
)
def test_fleece_boundary_at_42_days(shorn: str, expected: str) -> None:
    assert assess_sheep_blowfly([day(**MILD)], sheep(shorn))[0].level == expected


def test_fleece_reasons() -> None:
    assert "shorn 43 days ago" in assess_sheep_blowfly([day(**MILD)], sheep("2026-05-19"))[0].reason
    unknown = assess_sheep_blowfly([day(**MILD)], sheep(None))[0]
    assert unknown.level == "HIGH"
    assert "no shearing date is recorded" in unknown.reason


def test_fleece_rule_leaves_cold_days_low_and_needs_a_group() -> None:
    assert assess_sheep_blowfly([day(**{**MILD, "temp_mean_c": 5})], sheep(None))[0].level == "LOW"
    assert assess_sheep_blowfly([day(**MILD)])[0].level == "MEDIUM"
