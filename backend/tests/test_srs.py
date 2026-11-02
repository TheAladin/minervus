from itertools import product

import pytest

from app.srs import (
    INITIAL_EASE,
    MAX_INTERVAL_DAYS,
    MIN_EASE,
    Rating,
    Schedule,
    next_schedule,
)

NEW_CARD = Schedule()


def review(*ratings: Rating, start: Schedule = NEW_CARD) -> Schedule:
    schedule = start
    for rating in ratings:
        schedule = next_schedule(schedule, rating)
    return schedule


def test_good_follows_the_sm2_interval_sequence() -> None:
    intervals = []
    schedule = Schedule()
    for _ in range(5):
        schedule = next_schedule(schedule, Rating.GOOD)
        intervals.append(schedule.interval_days)

    # 1, 6, then the previous interval times 2.5.
    assert intervals == [1, 6, 15, 38, 95]
    assert schedule.ease == INITIAL_EASE
    assert schedule.repetitions == 5


@pytest.mark.parametrize(
    ("rating", "interval"),
    [(Rating.HARD, 1), (Rating.GOOD, 1), (Rating.EASY, 4)],
)
def test_first_review_intervals(rating: Rating, interval: int) -> None:
    assert next_schedule(Schedule(), rating).interval_days == interval


def test_again_is_due_now_and_restarts_the_sequence() -> None:
    schedule = review(Rating.GOOD, Rating.GOOD, Rating.GOOD, Rating.AGAIN)

    assert schedule.interval_days == 0
    assert schedule.repetitions == 0
    assert review(Rating.GOOD, start=schedule).interval_days == 1


@pytest.mark.parametrize(
    ("rating", "ease"),
    [
        (Rating.AGAIN, 2.3),
        (Rating.HARD, 2.36),
        (Rating.GOOD, 2.5),
        (Rating.EASY, 2.6),
    ],
)
def test_ease_changes_with_the_rating(rating: Rating, ease: float) -> None:
    assert next_schedule(Schedule(), rating).ease == ease


@pytest.mark.parametrize("rating", [Rating.AGAIN, Rating.HARD])
def test_ease_never_drops_below_the_minimum(rating: Rating) -> None:
    assert review(*[rating] * 20).ease == MIN_EASE


def test_ease_keeps_two_decimal_places_over_many_reviews() -> None:
    assert review(*[Rating.EASY] * 10).ease == 3.5


@pytest.mark.parametrize(
    ("repetitions", "interval", "ease"),
    list(product([2, 3, 10], [1, 2, 6, 15, 100, 1000], [MIN_EASE, 1.7, 2.5, 3.5])),
)
def test_better_ratings_never_give_shorter_intervals(
    repetitions: int, interval: int, ease: float
) -> None:
    current = Schedule(interval, ease, repetitions)

    again, hard, good, easy = (
        next_schedule(current, rating).interval_days for rating in Rating
    )

    assert again == 0
    assert interval < hard <= good < easy


@pytest.mark.parametrize("repetitions", [1, 2])
def test_passing_always_lengthens_the_interval(repetitions: int) -> None:
    current = Schedule(interval_days=1, ease=MIN_EASE, repetitions=repetitions)

    for rating in (Rating.HARD, Rating.GOOD, Rating.EASY):
        assert next_schedule(current, rating).interval_days > 1


def test_intervals_are_capped() -> None:
    current = Schedule(MAX_INTERVAL_DAYS, 3.0, 50)

    for rating in (Rating.HARD, Rating.GOOD, Rating.EASY):
        assert next_schedule(current, rating).interval_days == MAX_INTERVAL_DAYS


def test_next_schedule_does_not_mutate_its_input() -> None:
    current = Schedule(6, 2.5, 2)

    next_schedule(current, Rating.EASY)

    assert current == Schedule(6, 2.5, 2)
