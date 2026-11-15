import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / "backend"))

import uvicorn

if __name__ == "__main__":
    print("=" * 60)
    print("  ChessBuff - Full-Stack Chess.com Clone & Review Engine")
    print("=" * 60)
    print("  Local Server:  http://127.0.0.1:8000")
    print("  FastAPI Docs:  http://127.0.0.1:8000/docs")
    print("  Stockfish 19:  bin/stockfish.exe (MultiPV=2 Active)")
    print("=" * 60)

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info",
    )
