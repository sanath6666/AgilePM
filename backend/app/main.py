from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import get_client

# routers
from .auth import router as auth_router
from .users import router as users_router
from .projects import router as projects_router
from .tasks import router as tasks_router
from .bugs import router as bugs_router
from .sprints import router as sprints_router
from .notifications import router as notifications_router
from .ai_module import router as ai_router
from .dashboard import router as dashboard_router

app = FastAPI(title="AI-Enhanced Agile PM", version="1.0.0")

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def create_indexes():
    db = get_client()[settings.DB_NAME]
    await db.tasks.create_index("project_id")
    await db.tasks.create_index("sprint_id")
    await db.tasks.create_index("assigned_to")
    await db.bugs.create_index("project_id")
    await db.notifications.create_index([("user_id", 1), ("read", 1)])


# include routers
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(projects_router, prefix="/projects", tags=["projects"])
app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
app.include_router(bugs_router, prefix="/bugs", tags=["bugs"])
app.include_router(sprints_router, prefix="/sprints", tags=["sprints"])
app.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
app.include_router(ai_router, prefix="/ai", tags=["ai"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])


@app.get("/")
async def root():
    return {"status": "ok", "message": "AI-Enhanced Agile PM API"}
