"""Challenge / benchmark results (FTP tests, KB benchmarks, virtual climbs).

Challenge *definitions* live in the frontend (they're UI-heavy: test protocols,
climb profiles); the backend just stores attempts generically by key.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..db import get_db
from ..models import ChallengeResult
from ..schemas import ChallengeResultRequest

router = APIRouter(prefix="/api/challenges", tags=["challenges"],
                   dependencies=[Depends(require_auth)])


@router.get("/results")
def list_results(db: Session = Depends(get_db)):
    rows = (db.query(ChallengeResult)
            .order_by(desc(ChallengeResult.completed_at)).limit(500).all())
    return [r.to_dict() for r in rows]


@router.post("/results")
def add_result(req: ChallengeResultRequest, db: Session = Depends(get_db)):
    row = ChallengeResult(
        challenge_key=req.challenge_key,
        score=req.score,
        unit=req.unit,
        details=req.details,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row.to_dict()
