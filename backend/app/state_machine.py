from app.models import RideStatus


class InvalidStateTransitionError(Exception):
    """Exception raised when an invalid ride status transition is attempted."""
    def __init__(self, current_status: RideStatus, target_status: RideStatus):
        self.current_status = current_status
        self.target_status = target_status
        super().__init__(
            f"Cannot transition ride status from '{current_status.value}' to '{target_status.value}'."
        )


# Mapping of allowed state transitions
ALLOWED_TRANSITIONS: dict[RideStatus, set[RideStatus]] = {
    RideStatus.REQUESTED: {RideStatus.MATCHED, RideStatus.ACCEPTED, RideStatus.CANCELLED},
    RideStatus.MATCHED: {RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS, RideStatus.CANCELLED},
    RideStatus.ACCEPTED: {RideStatus.ARRIVED, RideStatus.IN_PROGRESS, RideStatus.CANCELLED},
    RideStatus.ARRIVED: {RideStatus.IN_PROGRESS, RideStatus.CANCELLED},
    RideStatus.IN_PROGRESS: {RideStatus.COMPLETED, RideStatus.CANCELLED},
    RideStatus.COMPLETED: set(),  # Terminal state
    RideStatus.CANCELLED: set(),  # Terminal state
}


def validate_transition(current_status: RideStatus, target_status: RideStatus) -> bool:
    """
    Validates if transitioning from current_status to target_status is allowed.
    Raises InvalidStateTransitionError if illegal.
    """
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise InvalidStateTransitionError(current_status, target_status)
    return True
