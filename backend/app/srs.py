"""SM-2 spaced repetition with four ratings. Pure logic, with no I/O."""

from dataclasses import dataclass
from enum import StrEnum

INITIAL_EASE = 2.5
MIN_EASE = 1.3
HARD_MULTIPLIER = 1.2
EASY_MULTIPLIER = 1.3
EASY_FIRST_INTERVAL_DAYS = 4
SECOND_INTERVAL_DAYS = 6
MAX_INTERVAL_DAYS = 36_500


class Rating(StrEnum):
    AGAIN = "again"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"


# Hard, Good and Easy match SM-2's quality scores of 3, 4 and 5. SM-2 keeps the ease
# on a lapse, but lowering it stops a card that keeps failing from growing quickly.
_EASE_CHANGE = {
    Rating.AGAIN: -0.2,
    Rating.HARD: -0.14,
    Rating.GOOD: 0.0,
    Rating.EASY: 0.1,
}


@dataclass(frozen=True)
class Schedule:
    interval_days: int = 0
    ease: float = INITIAL_EASE
    repetitions: int = 0


def _good_interval(current: Schedule) -> int:
    if current.repetitions == 0:
        return 1
    if current.repetitions == 1:
        return SECOND_INTERVAL_DAYS
    return max(current.interval_days + 1, round(current.interval_days * current.ease))


def _next_interval(current: Schedule, rating: Rating) -> int:
    if rating is Rating.HARD:
        if current.repetitions == 0:
            return 1
        return max(
            current.interval_days + 1, round(current.interval_days * HARD_MULTIPLIER)
        )

    good = _good_interval(current)
    if rating is Rating.GOOD:
        return good
    if current.repetitions == 0:
        return EASY_FIRST_INTERVAL_DAYS
    return max(good + 1, round(good * EASY_MULTIPLIER))


def next_schedule(current: Schedule, rating: Rating) -> Schedule:
    """Return the schedule after a review. An interval of 0 means due again now."""
    # Rounding stops float errors from accumulating over many reviews.
    ease = max(MIN_EASE, round(current.ease + _EASE_CHANGE[rating], 2))
    if rating is Rating.AGAIN:
        return Schedule(interval_days=0, ease=ease, repetitions=0)
    return Schedule(
        interval_days=min(_next_interval(current, rating), MAX_INTERVAL_DAYS),
        ease=ease,
        repetitions=current.repetitions + 1,
    )
