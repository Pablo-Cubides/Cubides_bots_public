import os
import re
from secrets import compare_digest
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

app = FastAPI(title="Business Agent / Socio", version="2.0.0")

# --- Rutas de Memoria Socio V2.0 ---
DATA_DIR = os.getenv("AGENT_DATA_DIR", "/app/data")
TASKS_DIR = f"{DATA_DIR}/tasks"
LOGS_DIR = f"{DATA_DIR}/logs"

TASK_PLAN_FILE = f"{TASKS_DIR}/task_plan.md"
PROGRESS_FILE = f"{LOGS_DIR}/progress.md"
ADMIN_TOKEN = os.getenv("AGENT_ADMIN_TOKEN", "").strip()

class TaskRequest(BaseModel):
    task: str = Field(min_length=1, max_length=2000)

def require_admin_token(x_agent_admin_token: str | None = Header(default=None)) -> None:
    if not ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AGENT_ADMIN_TOKEN no configurado",
        )
    if not x_agent_admin_token or not compare_digest(x_agent_admin_token, ADMIN_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token administrativo invalido",
        )

def normalize_task(raw: str) -> str:
    task = raw.replace("\r\n", " ").replace("\r", " ").replace("\n", " ")
    task = _CONTROL_RE.sub("", task)
    task = " ".join(task.split())
    # Escapar caracteres XML para que el contenido no rompa los delimitadores
    # de confianza que el daemon añade alrededor de la tarea en el prompt.
    task = task.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    if not task:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La tarea no puede estar vacia",
        )
    return task

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "agent": "business_agent"}

@app.get("/", response_class=HTMLResponse)
def read_root():
    try:
        with open("/app/app/index.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "UI no encontrada"

@app.post("/api/task")
def add_task(req: TaskRequest, _: None = Depends(require_admin_token)):
    task = normalize_task(req.task)
    os.makedirs(TASKS_DIR, exist_ok=True)
    with open(TASK_PLAN_FILE, "a+", encoding="utf-8") as f:
        f.write(f"\n- [ ] {task}\n")
    
    os.makedirs(LOGS_DIR, exist_ok=True)
    with open(PROGRESS_FILE, "a+", encoding="utf-8") as f:
        f.write(f"\n- [UI] Misión añadida manualmente: {task}\n")
        
    return {"status": "success", "message": "Task added"}

@app.get("/api/logs")
def get_logs(_: None = Depends(require_admin_token)):
    try:
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return {"logs": f.read()}
    except Exception:
        return {"logs": "Archivo de progreso no encontrado."}



