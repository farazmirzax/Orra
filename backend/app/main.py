from fastapi import FastAPI
from app.api.routes import router
from app.core.database import engine, Base
from app.models import workflow # Import models so SQLAlchemy knows about them

# Create the database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Orra API",
    description="Backend execution engine for Orra AI workflows",
    version="0.1.0"
)

app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to the Orra API. System is online."}