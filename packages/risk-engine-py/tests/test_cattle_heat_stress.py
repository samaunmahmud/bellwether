import pytest

from bellwether_risk import DailyRisk

from bellwether_risk import assess_cattle_heat_stress, calculate_thi
from helpers import day


@pytest.mark.parametrize(
    ("t", "rh", "expected"),
    [
        (20, 50, 65.25),  # 68 - (0.275)(10)
        (25, 60, 72.82),  # 77 - (0.22)(19)
        (30, 80, 82.92),  # 86 - (0.11)(28)
        (10, 100, 50),  # RH=100 removes the correction term: THI = 1.8T + 32
    ],
)
def test_calculate_thi_hand_worked(t: float, rh: float, expected: float) -> None:
    assert calculate_thi(t, rh) == pytest.approx(expected, abs=0.005)


def assess(temp_max_c: float, humidity_mean_pct: float) -> DailyRisk:
    return assess_cattle_heat_stress(
        [day(temp_max_c=temp_max_c, humidity_mean_pct=humidity_mean_pct)]
    )[0]


def test_levels_and_reason() -> None:
    assert assess(20, 50).level == "LOW"
    assert "THI 65.3" in assess(20, 50).reason  # 65.25 shown half-up, as in the TS engine
    assert assess(22, 60).level == "MEDIUM"  # 68.608
    assert assess(25, 60).reason == "THI 72.8: heat stress likely"


def test_exact_boundaries() -> None:
    assert assess(20, 100).level == "MEDIUM"  # THI 68
    assert assess(40 / 1.8, 100).level == "HIGH"  # THI 72


def test_score_is_clamped() -> None:
    assert assess(-10, 50).score == 0
    assert assess(45, 90).score == 100
