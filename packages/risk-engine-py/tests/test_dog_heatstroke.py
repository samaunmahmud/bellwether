import pytest

from bellwether_risk import assess_dog_heatstroke
from helpers import day


@pytest.mark.parametrize(
    ("temp", "expected"), [(19.9, "LOW"), (20, "MEDIUM"), (25, "MEDIUM"), (25.1, "HIGH")]
)
def test_boundaries(temp: float, expected: str) -> None:
    assert assess_dog_heatstroke([day(temp_max_c=temp)])[0].level == expected


def test_suggests_cooler_hours_without_medical_instructions() -> None:
    reason = assess_dog_heatstroke([day(temp_max_c=30)])[0].reason.lower()
    assert "early morning or evening" in reason
    assert not any(word in reason for word in ("dose", "medicine", "drug"))
