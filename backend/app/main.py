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

#CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], # Allows your Next.js app
    allow_credentials=True,
    allow_methods=["*"], # Allows POST, GET, etc.
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to the Orra API. System is online."}
