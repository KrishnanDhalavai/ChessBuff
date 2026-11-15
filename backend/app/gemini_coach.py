import asyncio
import time
import json
from typing import List, Dict, Any, Optional
import httpx
from .config import (
    GEMINI_API_KEY,
    PRIMARY_MODEL,
    SECONDARY_MODEL,
    TERTIARY_MODEL,
    MAX_CONCURRENT_GEMINI_REQUESTS,
    GEMINI_RPM_LIMIT,
)

# Concurrency Semaphore & Token Bucket Rate Limiter
_CONCURRENCY_SEMAPHORE: Optional[asyncio.Semaphore] = None

def get_concurrency_semaphore() -> asyncio.Semaphore:
    global _CONCURRENCY_SEMAPHORE
    if _CONCURRENCY_SEMAPHORE is None:
        _CONCURRENCY_SEMAPHORE = asyncio.Semaphore(MAX_CONCURRENT_GEMINI_REQUESTS)
    return _CONCURRENCY_SEMAPHORE

class TokenBucketRateLimiter:
    def __init__(self, rpm: int):
        self.capacity = float(rpm)
        self.tokens = float(rpm)
        self.fill_rate = float(rpm) / 60.0  # tokens per second
        self.last_time = time.monotonic()
        self.lock: Optional[asyncio.Lock] = None

    def _get_lock(self) -> asyncio.Lock:
        if self.lock is None:
            self.lock = asyncio.Lock()
        return self.lock

    async def acquire(self):
        async with self._get_lock():
            now = time.monotonic()
            elapsed = now - self.last_time
            self.last_time = now
            self.tokens = min(self.capacity, self.tokens + elapsed * self.fill_rate)

            if self.tokens < 1.0:
                wait_seconds = (1.0 - self.tokens) / self.fill_rate
                await asyncio.sleep(wait_seconds)
                self.tokens = 0.0
                self.last_time = time.monotonic()
            else:
                self.tokens -= 1.0

_RATE_LIMITER = TokenBucketRateLimiter(GEMINI_RPM_LIMIT)

def generate_symbolic_explanation(event: Dict[str, Any]) -> Dict[str, str]:
    """
    Deterministic Neuro-Symbolic Virtual Coach generator (Zero Hallucination).
    Used as instant reliable explanation and as 100% offline fallback.
    """
    tier = event.get("classification", "").lower()
    san = event.get("san", "")
    best_san = event.get("best_move_san", "")
    mover = event.get("mover", "White")
    tactics = event.get("tactics", {})

    fork = tactics.get("fork")
    pin = tactics.get("pin")
    hanging = tactics.get("hanging_pieces", [])
    quiescence = tactics.get("quiescence")
    missed_mate = tactics.get("missed_mate", False)
    back_rank = tactics.get("back_rank_weakness", False)

    explanation = ""
    tip = ""

    if tier == "brilliant":
        explanation = f"A brilliant sacrifice with {san}! You gave up material to completely dismantle the opponent's structure and seize unstoppable initiative."
        tip = "Dynamic piece sacrifices create long-term tactical pressure that outweighs material value."
    elif tier == "great":
        explanation = f"An exceptional find with {san}! This was the only move on the board that held the critical advantage."
        tip = "Recognizing sharp 'only-moves' in tense positions is the hallmark of master-level defense."
    elif tier == "blunder":
        if missed_mate:
            explanation = f"{san} completely misses a forced checkmate line! {best_san} would have delivered rapid mate."
            tip = "Always check for forcing checks and king restriction before quiet moves."
        elif fork:
            explanation = f"{san} falls into a vicious fork. The opponent's {fork.get('attacker_piece', 'piece')} on {fork.get('attacker', '')} attacks both your {fork.get('target1_piece', '')} on {fork.get('target1', '')} and {fork.get('target2_piece', '')} on {fork.get('target2', '')}."
            tip = "Look out for geometric lines where enemy pieces can attack two targets at once."
        elif pin:
            pinned = pin.get("pinned_pieces", [{}])[0]
            explanation = f"{san} leads into a debilitating pin on your {pinned.get('piece', 'piece')} on {pinned.get('square', '')}."
            tip = "Avoid placing valuable pieces on the same rank, file, or diagonal as your king."
        elif hanging:
            h = hanging[0]
            explanation = f"{san} leaves your {h.get('piece', 'piece')} on {h.get('square', '')} completely undefended."
            tip = "Always verify which pieces lose protection after a move."
        elif quiescence and quiescence.get("net_material_delta", 0) < 0:
            lost = abs(quiescence["net_material_delta"])
            explanation = f"{san} loses {lost} points of material after Stockfish's refutation sequence."
            tip = "Calculate trades all the way through to the end of the forcing sequence."
        else:
            explanation = f"{san} swings the game dramatically in your opponent's favor. The optimal choice was {best_san}."
            tip = "Take extra time in volatile positions with high tactical tension."
    elif tier == "mistake":
        if hanging:
            h = hanging[0]
            explanation = f"{san} allows the opponent to target your {h.get('piece', 'piece')} on {h.get('square', '')}."
            tip = "Guard against tactical threats before pursuing your own attacking plans."
        else:
            explanation = f"{san} yields a significant positional concession. {best_san} was far more precise."
            tip = "Consider opponent responses and counterplay before committing."
    elif tier == "inaccuracy":
        explanation = f"{san} is slightly imprecise. Playing {best_san} would have exerted stronger pressure."
        tip = "Try to coordinate your pieces to control key central outposts."
    elif tier == "miss":
        explanation = f"{san} missed a golden opportunity to punish your opponent's mistake! {best_san} was the winning continuation."
        tip = "When your opponent blunders, take a deep breath and search for immediate tactical punishments."
    else:
        explanation = f"Solid move with {san}."
        tip = "Maintain steady piece coordination."

    return {
        "ply": event.get("ply", 1),
        "classification": event.get("classification", ""),
        "explanation": explanation,
        "coach_tip": tip,
    }

async def generate_gemini_coach_reviews(
    critical_events: List[Dict[str, Any]],
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Single-Batch Gemini Coach:
    1 Game = 1 API Request sent to Gemini Flash with Structured Outputs.
    If API key is missing or calls exhaust quota (HTTP 429), automatically
    falls back through the model chain and neuro-symbolic generator.
    """
    if not critical_events:
        return []

    active_key = api_key or GEMINI_API_KEY
    if not active_key:
        # Seamless deterministic symbolic coach
        return [generate_symbolic_explanation(evt) for evt in critical_events]

    # Pre-filter payload to be minimal and structured
    payload_events = []
    for evt in critical_events:
        payload_events.append({
            "ply": evt.get("ply"),
            "san": evt.get("san"),
            "mover": evt.get("mover"),
            "classification": evt.get("classification"),
            "delta_win_prob": round(evt.get("delta_w", 0), 1),
            "best_move_san": evt.get("best_move_san"),
            "refutation_san": evt.get("refutation_san", []),
            "tactics": evt.get("tactics", {}),
        })

    prompt_content = (
        "You are the Chess.com Diamond Virtual Coach. You are reviewing critical moves from a chess game.\n"
        "Here are the deterministic, verified tactical facts extracted for each critical move:\n"
        f"{json.dumps(payload_events, indent=2)}\n\n"
        "For EACH event, provide:\n"
        "1. 'ply': the exact integer ply number\n"
        "2. 'classification': the classification string\n"
        "3. 'explanation': 1-2 concise, punchy, human-like sentences explaining why the move was good or bad using the verified tactical facts (pieces, squares, tactics).\n"
        "4. 'coach_tip': a short actionable master tip (max 1 sentence).\n"
        "Respond ONLY with a JSON array conforming to this schema."
    )

    models_to_try = [PRIMARY_MODEL, SECONDARY_MODEL, TERTIARY_MODEL]

    for model in models_to_try:
        try:
            await _RATE_LIMITER.acquire()
            async with get_concurrency_semaphore():
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                headers = {
                    "x-goog-api-key": active_key,
                    "Content-Type": "application/json"
                }
                body = {
                    "contents": [{
                        "parts": [{"text": prompt_content}]
                    }],
                    "generationConfig": {
                        "temperature": 0.2,
                        "responseMimeType": "application/json",
                        "responseSchema": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "ply": {"type": "INTEGER"},
                                    "classification": {"type": "STRING"},
                                    "explanation": {"type": "STRING"},
                                    "coach_tip": {"type": "STRING"}
                                },
                                "required": ["ply", "classification", "explanation", "coach_tip"]
                            }
                        }
                    }
                }

                async with httpx.AsyncClient(timeout=25.0) as client:
                    resp = await client.post(url, headers=headers, json=body)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            raw_text = candidates[0]["content"]["parts"][0]["text"]
                            parsed = json.loads(raw_text)
                            if isinstance(parsed, list) and len(parsed) > 0:
                                return parsed
                    elif resp.status_code == 429:
                        print(f"[Gemini Coach] 429 on {model}, attempting failover...")
                        continue
                    else:
                        print(f"[Gemini Coach] HTTP {resp.status_code} on {model}: {resp.text}")
        except Exception as e:
            print(f"[Gemini Coach] Exception on {model}: {e}")

    # Fallback to symbolic engine if all API calls fail or timeout
    return [generate_symbolic_explanation(evt) for evt in critical_events]
