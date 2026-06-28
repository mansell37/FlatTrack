"""User settings (FTP, default energy, preferences)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..db import get_db
from ..models import Settings
from ..schemas import SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"],
                   dependencies=[Depends(require_auth)])


def _get(db: Session) -> Settings:
    s = db.get(Settings, 1)
    if not s:
        s = Settings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    return _get(db).to_dict()


@router.put("")
def update_settings(req: SettingsUpdate, db: Session = Depends(get_db)):
    s = _get(db)
    if req.ftp is not None:
        s.ftp = req.ftp
    if req.default_energy is not None:
        s.default_energy = req.default_energy
    if req.prefs is not None:
        s.prefs = req.prefs
    db.commit()
    db.refresh(s)
    return s.to_dict()
