"""Garmin Connect integration: build a cycling workout from our schema, upload it,
and schedule it on the calendar (which syncs to a paired Edge).

Auth uses GARMIN_EMAIL / GARMIN_PASSWORD (Railway secrets). The garth session
token is cached in Postgres (GarminToken) so we avoid logging in on every request
and survive Railway's ephemeral filesystem.

NOTE: the upload path must be validated against a live account. If the account has
MFA enabled, headless login may fail — the API surfaces a clear error and the UI
falls back to on-screen / manual use.
"""
from datetime import date

from sqlalchemy.orm import Session

from .config import GARMIN_EMAIL, GARMIN_PASSWORD
from .models import GarminToken

# Garmin Connect workout enum mappings (unofficial but stable).
_SPORT_CYCLING = {"sportTypeId": 2, "sportTypeKey": "cycling"}
_STEP_TYPE = {
    "warmup": {"stepTypeId": 1, "stepTypeKey": "warmup"},
    "cooldown": {"stepTypeId": 2, "stepTypeKey": "cooldown"},
    "work": {"stepTypeId": 3, "stepTypeKey": "interval"},
    "rest": {"stepTypeId": 4, "stepTypeKey": "recovery"},
}
_END_TIME = {"conditionTypeId": 2, "conditionTypeKey": "time"}
_TARGET_POWER = {"workoutTargetTypeId": 2, "workoutTargetTypeKey": "power.zone"}
_TARGET_NONE = {"workoutTargetTypeId": 1, "workoutTargetTypeKey": "no.target"}


def is_configured() -> bool:
    return bool(GARMIN_EMAIL and GARMIN_PASSWORD)


def _save_token(db: Session, token_str: str):
    row = db.get(GarminToken, 1)
    if not row:
        row = GarminToken(id=1)
        db.add(row)
    row.token_json = token_str
    db.commit()


def get_client(db: Session):
    """Return an authenticated garminconnect client, reusing a cached token if valid."""
    if not is_configured():
        raise RuntimeError("Garmin credentials are not configured (set GARMIN_EMAIL / GARMIN_PASSWORD).")

    from garminconnect import Garmin

    row = db.get(GarminToken, 1)
    # Try the cached session first.
    if row and row.token_json:
        try:
            client = Garmin()
            client.garth.loads(row.token_json)
            client.get_full_name()  # cheap validation call
            return client
        except Exception:
            pass  # fall through to a fresh login

    client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
    client.login()
    try:
        _save_token(db, client.garth.dumps())
    except Exception:
        pass  # token caching is best-effort; login still worked
    return client


def _step(order, block, ftp_unused=None):
    """Map one of our workout blocks to a Garmin ExecutableStepDTO."""
    kind = block.get("kind", "work")
    step_type = _STEP_TYPE.get(kind, _STEP_TYPE["work"])
    seconds = block.get("seconds") or 60
    step = {
        "type": "ExecutableStepDTO",
        "stepOrder": order,
        "stepType": step_type,
        "endCondition": _END_TIME,
        "endConditionValue": float(seconds),
        "description": (block.get("notes") or "")[:512],
    }
    watts = block.get("watts")
    if watts and kind in ("work", "warmup"):
        # +/- 5% power window around the target.
        step["targetType"] = _TARGET_POWER
        step["targetValueOne"] = float(round(watts * 0.95))
        step["targetValueTwo"] = float(round(watts * 1.05))
    else:
        step["targetType"] = _TARGET_NONE
    return step


def build_cycling_payload(workout: dict) -> dict:
    """Translate a cardio workout dict into a Garmin Connect workout payload."""
    steps = [_step(i + 1, b) for i, b in enumerate(workout.get("blocks", []))]
    return {
        "sportType": _SPORT_CYCLING,
        "workoutName": workout.get("title", "Office Heat ride")[:80],
        "description": (workout.get("summary") or "")[:1024],
        "workoutSegments": [{
            "segmentOrder": 1,
            "sportType": _SPORT_CYCLING,
            "workoutSteps": steps,
        }],
    }


def upload_and_schedule(db: Session, workout: dict, on_date: str | None = None) -> dict:
    """Upload a cycling workout and schedule it for ``on_date`` (default: today)."""
    if workout.get("type") != "cardio":
        raise ValueError("Only cardio (bike) workouts can be sent to Garmin.")

    client = get_client(db)
    payload = build_cycling_payload(workout)

    created = client.garth.connectapi(
        "/workout-service/workout", method="POST", json=payload
    )
    workout_id = created.get("workoutId") if isinstance(created, dict) else None
    if not workout_id:
        raise RuntimeError(f"Garmin did not return a workout id (response: {created!r}).")

    sched_date = on_date or date.today().isoformat()
    client.garth.connectapi(
        f"/workout-service/schedule/{workout_id}", method="POST", json={"date": sched_date}
    )
    return {"workout_id": workout_id, "scheduled_for": sched_date}
