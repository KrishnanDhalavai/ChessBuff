import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from app.main import create_game_review, health_check, list_games_archive, get_game_review
from app.models import ReviewRequest

async def test_api_pipeline():
    print("--- 1. Testing Health Check ---", flush=True)
    h = await health_check()
    print("Health check response:", h, flush=True)
    assert h["status"] == "healthy"
    assert h["stockfish_detected"] is True

    print("\n--- 2. Testing Game Review Pipeline ---", flush=True)
    moves = [
        "e4", "e5", "Nf3", "d6", "d4", "Bg4", "dxe5", "Bxf3",
        "Qxf3", "dxe5", "Bc4", "Nf6", "Qb3", "Qe7", "Nc3", "c6"
    ]
    req = ReviewRequest(
        moves=moves,
        white_player="Morphy",
        black_player="Duke & Count",
        result="1-0"
    )
    review = await create_game_review(req)
    print("Review generated successfully!", flush=True)
    print(f"Game Hash: {review['game_hash']}", flush=True)
    print(f"Opening: {review['eco_code']} - {review['opening_name']}", flush=True)
    print(f"White Accuracy: {review['white_accuracy']}%", flush=True)
    print(f"Black Accuracy: {review['black_accuracy']}%", flush=True)
    print(f"White Move Counts: {review['white_counts']}", flush=True)
    print(f"Black Move Counts: {review['black_counts']}", flush=True)
    print(f"Coach Summary: {review.get('coach_summary')}", flush=True)

    print("\n--- 3. Testing O(1) Cache Retrieval ---", flush=True)
    cached = await get_game_review(review["game_hash"])
    assert cached["game_hash"] == review["game_hash"]
    print("O(1) Cache Hit Verified!", flush=True)

    print("\n--- 4. Testing Chronological Archive Query ---", flush=True)
    archive_games = await list_games_archive(limit=10, offset=0)
    print(f"Found {len(archive_games)} games in archive.", flush=True)
    assert len(archive_games) >= 1

    print("\nALL API PIPELINE TESTS PASSED!", flush=True)

if __name__ == "__main__":
    asyncio.run(test_api_pipeline())
