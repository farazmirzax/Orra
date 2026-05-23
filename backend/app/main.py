from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(
    title= "Orra API",
    description= "Backend execution engine for Orra workflows",
    version= "0.1.0"
)

#Include our API routes
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return{"message":"Welcome to the Orra API. System is Online!"}