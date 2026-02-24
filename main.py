from fastapi import FastAPI
from pydantic import BaseModel
import os
import openai
import httpx
from fastapi.middleware.cors import CORSMiddleware
