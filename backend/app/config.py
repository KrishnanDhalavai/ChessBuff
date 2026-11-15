import os
from pathlib import Path
from dotenv import load_dotenv

# Paths
APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

# Load environment variables from .env
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env")

BIN_DIR = PROJECT_ROOT / "bin"
STOCKFISH_PATH = str(BIN_DIR / "stockfish.exe")
if not os.path.exists(STOCKFISH_PATH):
    # Check if stockfish is in PATH
    import shutil
    found = shutil.which("stockfish")
    if found:
        STOCKFISH_PATH = found

DB_PATH = str(PROJECT_ROOT / "chessbuff.db")

# Gemini LLM Settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
PRIMARY_MODEL = os.getenv("PRIMARY_MODEL", "gemini-3.5-flash-lite")
SECONDARY_MODEL = os.getenv("SECONDARY_MODEL", "gemini-3.5-flash")
TERTIARY_MODEL = os.getenv("TERTIARY_MODEL", "gemini-3.8-flash")

# Rate Limiting & Concurrency
MAX_CONCURRENT_GEMINI_REQUESTS = 2
GEMINI_RPM_LIMIT = 15  # Free tier safe ceiling
DEFAULT_ENGINE_DEPTH = 16  # MultiPV target depth
