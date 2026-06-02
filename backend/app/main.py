import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

allowed_origins = [
    origin.strip()
    for origin in os.environ.get(
        "ORRA_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]

#CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins, #For nextjs
    allow_credentials=True,
    allow_methods=["*"], # For HTTP Methods
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to the Orra API. System is online."}
