from fastapi import APIRouter
from app.api.endpoints import tutor, executor, files, terminal, jarvis, rag, agent, knowledge

api_router = APIRouter()

api_router.include_router(tutor.router, prefix="/tutor", tags=["tutor"])
api_router.include_router(executor.router, prefix="/executor", tags=["executor"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(terminal.router, prefix="/terminal", tags=["terminal"])
api_router.include_router(jarvis.router, prefix="/jarvis", tags=["jarvis"])
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
