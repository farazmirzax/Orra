from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# We use a local SQLite file named 'orra.db'
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