import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Check if Vercel's environment variable exists
IS_VERCEL = os.environ.get("VERCEL")

if IS_VERCEL:
    # Vercel only allows writing to the /tmp folder! (Requires 4 slashes for absolute path)
    SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/orra.db"
else:
    # Local development uses the normal project folder (3 slashes for relative path)
    SQLALCHEMY_DATABASE_URL = "sqlite:///./orra.db"

# connect_args is needed only for SQLite to prevent thread issues
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get the DB session in our API routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()