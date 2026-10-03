import pytest
from app.models import RideStatus
from app.state_machine import validate_transition, InvalidStateTransitionError


def test_valid_state_transitions():
    assert validate_transition(RideStatus.REQUESTED, RideStatus.MATCHED) is True
    assert validate_transition(RideStatus.REQUESTED, RideStatus.CANCELLED) is True
    assert validate_transition(RideStatus.MATCHED, RideStatus.IN_PROGRESS) is True
    assert validate_transition(RideStatus.MATCHED, RideStatus.CANCELLED) is True
    assert validate_transition(RideStatus.IN_PROGRESS, RideStatus.COMPLETED) is True


def test_invalid_state_transitions():
    # Cannot jump straight from REQUESTED to COMPLETED
    with pytest.raises(InvalidStateTransitionError):
        validate_transition(RideStatus.REQUESTED, RideStatus.COMPLETED)

    # Cannot jump from COMPLETED back to IN_PROGRESS
    with pytest.raises(InvalidStateTransitionError):
        validate_transition(RideStatus.COMPLETED, RideStatus.IN_PROGRESS)

    # Cannot jump from CANCELLED to MATCHED
    with pytest.raises(InvalidStateTransitionError):
        validate_transition(RideStatus.CANCELLED, RideStatus.MATCHED)
