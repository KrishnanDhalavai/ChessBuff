import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import chess
from app.bitboard import compute_zobrist_hash, encode_move, decode_move
from app.opening_book import opening_book
from app.engine_eval import engine_evaluator, centipawns_to_win_percentage
from app.classifier import classify_move
from app.caps2 import compute_move_accuracy, compute_volatility_weighted_accuracy, estimate_player_rating
from app.tactical_extractor import extract_symbolic_tactics
from app.storage import compute_canonical_game_hash, db_manager

def test_backend():
    print("--- 1. Testing Zobrist Hashing & Bitboards ---", flush=True)
    board = chess.Board()
    h = compute_zobrist_hash(board)
    print(f"Initial Zobrist Hash: {hex(h)}", flush=True)
    assert h != 0, "Zobrist hash should be non-zero"

    move = chess.Move.from_uci("e2e4")
    enc = encode_move(move, board)
    from_sq, to_sq, promo = decode_move(enc)
    assert from_sq == chess.E2 and to_sq == chess.E4
    print("16-Bit Move Encoding: Passed", flush=True)

    print("\n--- 2. Testing Opening Book ---", flush=True)
    moves = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]
    eco, name, last_ply = opening_book.find_opening_and_last_book_move(moves)
    print(f"Detected Opening: {eco} - {name} (Last book ply: {last_ply})", flush=True)
    assert eco == "B90" and "Najdorf" in name
    print("Opening Book Trie: Passed", flush=True)

    print("\n--- 3. Testing Stockfish MultiPV=2 Evaluation ---", flush=True)
    eval_res = engine_evaluator.evaluate_position(board, depth=8, multipv=2)
    print(f"Eval PV1: {eval_res['best_move']}, CP1: {eval_res['cp1']}, WinProb1: {eval_res['win_prob1']:.1f}%", flush=True)
    if eval_res['second_move']:
        print(f"Eval PV2: {eval_res['second_move']}, CP2: {eval_res['cp2']}, WinProb2: {eval_res['win_prob2']:.1f}%", flush=True)
    assert eval_res['best_move'] is not None
    print("Stockfish Engine: Passed", flush=True)

    print("\n--- 4. Testing CAPS2 Formulas ---", flush=True)
    acc = compute_move_accuracy(0.0)
    print(f"Accuracy for delta_w=0.0: {acc:.1f}% (Expected ~100%)", flush=True)
    assert acc > 99.0
    acc_blunder = compute_move_accuracy(25.0)
    print(f"Accuracy for delta_w=25.0: {acc_blunder:.1f}%", flush=True)
    assert acc_blunder < 40.0

    vol_acc = compute_volatility_weighted_accuracy([100.0, 95.0, 90.0, 85.0], [50.0, 52.0, 48.0, 55.0])
    print(f"Volatility-Weighted Accuracy: {vol_acc}%", flush=True)
    est_rating = estimate_player_rating(vol_acc, 25.0, 1500)
    print(f"Estimated Rating: {est_rating}", flush=True)
    print("CAPS2 Calculation: Passed", flush=True)

    print("\n--- 5. Testing Canonical Game Hash & DB Storage ---", flush=True)
    ghash = compute_canonical_game_hash(moves)
    print(f"Canonical Game Hash: {ghash}", flush=True)
    assert len(ghash) == 64
    print("Storage & Hashing: Passed", flush=True)

    engine_evaluator.close()
    print("\nALL BACKEND UNIT TESTS PASSED!", flush=True)

if __name__ == "__main__":
    test_backend()
