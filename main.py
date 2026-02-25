from fastapi import FastAPI
from pydantic import BaseModel
import os
import openai
import httpx
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

class QueryRequest(BaseModel):
    query: str
    mode: str

@app.post("/process")
async def process_query(data: QueryRequest): # ai router routing goes here but not yet