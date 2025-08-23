from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import os, re

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

BASE_DIR = Path(os.getenv("PAD_DIR", Path.cwd() / "pads"))
BASE_DIR.mkdir(parents=True, exist_ok=True)

SAFE_ID = re.compile(r"[A-Za-z0-9_\-]+")  # conservative

def sanitize(chat_id: str | None) -> str:
    if not chat_id:
        return "default"
    return chat_id if SAFE_ID.fullmatch(chat_id) else "default"

def file_for(chat_id: str | None) -> Path:
    cid = sanitize(chat_id)
    return BASE_DIR / f"{cid}.md"

def read_pad_text(chat_id: str | None) -> str:
    p = file_for(chat_id)
    return p.read_text(encoding="utf-8") if p.exists() else ""

def write_pad_text(chat_id: str | None, text: str) -> None:
    p = file_for(chat_id)
    p.write_text(text, encoding="utf-8")

class PadPutRequest(BaseModel):
    text: str
    chat_id: str | None = None

class PadAction(BaseModel):
    action: str  # "get" | "set"
    text: str | None = None
    chat_id: str | None = None

@app.get("/pad")
def get_pad() -> dict:
    # legacy: single shared file
    return {"text": read_pad_text(None)}

@app.put("/pad")
def put_pad(req: PadPutRequest) -> dict:
    # legacy: single shared file
    write_pad_text(None, req.text)
    return {"ok": True, "text": req.text}

@app.post("/pad")
def pad_action(req: PadAction) -> dict:
    act = req.action.lower().strip()
    if act == "get":
        return {"text": read_pad_text(req.chat_id)}
    if act == "set":
        if req.text is None:
            raise HTTPException(status_code=400, detail="text is required for 'set'")
        write_pad_text(req.chat_id, req.text)
        return {"ok": True, "text": req.text}
    raise HTTPException(status_code=400, detail="action must be 'get' or 'set'")

@app.get("/hi")
def hi() -> dict:
    return {"ok": True}