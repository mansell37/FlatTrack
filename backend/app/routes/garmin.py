"""Garmin upload endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import garmin
from ..auth import require_auth
from ..db import get_db
from ..schemas import GarminUploadRequest

router = APIRouter(prefix="/api/garmin", tags=["garmin"],
                   dependencies=[Depends(require_auth)])


@router.get("/status")
def status():
    return {"configured": garmin.is_configured()}


@router.post("/upload")
def upload(req: GarminUploadRequest, db: Session = Depends(get_db)):
    if not garmin.is_configured():
        raise HTTPException(400, "Garmin is not configured. Set GARMIN_EMAIL / GARMIN_PASSWORD.")
    try:
        result = garmin.upload_and_schedule(db, req.workout, req.date)
    except Exception as e:
        # Bubble up a readable message (e.g. MFA / login failures) for the UI fallback.
        raise HTTPException(502, f"Garmin upload failed: {e}")
    return {"ok": True, **result}
