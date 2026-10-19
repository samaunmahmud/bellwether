import pytest

from bellwether_risk import assess_tick
from helpers import day


def level(high_exposure_habitat: bool = False, **overrides: float) -> str:
    return assess_tick([day(**overrides)], high_exposure_habitat)[0].level


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"temp_mean_c": 4.9, "humidity_mean_pct": 95}, "LOW"),  # just below cold
        ({"temp_mean_c": 5, "humidity_mean_pct": 95}, "MEDIUM"),  # on cold
        ({"temp_mean_c": 7, "humidity_mean_pct": 80}, "HIGH"),  # on mild and humid
        ({"temp_mean_c": 6.9, "humidity_mean_pct": 90}, "MEDIUM"),
        ({"temp_mean_c": 12, "humidity_mean_pct": 79.9}, "MEDIUM"),
        ({"temp_mean_c": 22, "temp_max_c": 28, "humidity_mean_pct": 59}, "LOW"),  # hot and dry
        ({"temp_mean_c": 22, "temp_max_c": 30, "humidity_mean_pct": 60}, "MEDIUM"),
        ({"temp_mean_c": 22, "temp_max_c": 27.9, "humidity_mean_pct": 50}, "MEDIUM"),
    ],
)
def test_boundaries(overrides: dict[str, float], expected: str) -> None:
    assert level(**overrides) == expected


def test_high_exposure_raises_one_step_and_says_why() -> None:
    [result] = assess_tick([day(temp_mean_c=3)], high_exposure_habitat=True)
    assert result.level == "MEDIUM"
    assert "long grass or woodland" in result.reason
    assert level(True, temp_mean_c=10, humidity_mean_pct=60) == "HIGH"


def test_high_exposure_leaves_high_unchanged() -> None:
    [result] = assess_tick([day(temp_mean_c=10, humidity_mean_pct=90)], high_exposure_habitat=True)
    assert result.level == "HIGH"
    assert "long grass" not in result.reason
