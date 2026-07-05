"""FastAPI entrypoint: API routes + serving the built React frontend."""
from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .auth import check_password, require_auth, set_auth_cookie
from .config import AUTH_ENABLED, FRONTEND_DIST
from .db import init_db
from .routes import challenges as challenge_routes
from .routes import garmin as garmin_routes
from .routes import settings as settings_routes
from .routes import workouts as workout_routes
from .schemas import LoginRequest

app = FastAPI(title="FlatTrack", version="1.0.0")

# CORS is permissive only to support running the Vite dev server on a different
# port during local development; in production the frontend is same-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


# ---- auth ----
@app.post("/api/login")
def login(req: LoginRequest, response: Response):
    if not AUTH_ENABLED:
        return {"ok": True, "auth_enabled": False}
    if not check_password(req.password):
        raise HTTPException(401, "Incorrect password")
    set_auth_cookie(response)
    return {"ok": True, "auth_enabled": True}


@app.get("/api/me")
def me(_: bool = Depends(require_auth)):
    return {"authed": True, "auth_enabled": AUTH_ENABLED}


@app.get("/api/auth-config")
def auth_config():
    """Unauthenticated: lets the frontend know whether to show the login screen."""
    return {"auth_enabled": AUTH_ENABLED}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---- feature routers ----
app.include_router(workout_routes.router)
app.include_router(settings_routes.router)
app.include_router(garmin_routes.router)
app.include_router(challenge_routes.router)


# ---- serve the built frontend (production) ----
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        # Anything not matched above falls through to the SPA index for client routing.
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
