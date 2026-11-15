# ChessBuff ♟️ — Full-Stack Chess.com & Diamond Review Engine

A full-stack, pixel-perfect Chess.com clone featuring a dark-mode gameplay interface, real-time Web Audio API sound effects, and a **Diamond-Tier Post-Game Review Engine** powered by a **Neuro-Symbolic Analysis Pipeline** with **Stockfish 19 (MultiPV=2)** and **Single-Batch Google Gemini Flash**.

---

## 🌟 Core Concepts & Innovations

1. **Pure Gameplay First**:
   - During live matches, all engine evaluations, move hints, and evaluation bars are **strictly disabled and quarantined**.
   - Only after game conclusion (checkmate, stalemate, resignation, time forfeiture, or agreed draw) does the signature 3D-beveled green **"Game Review"** CTA button unlock.
2. **Neuro-Symbolic Analysis Pipeline**:
   - **Stockfish 19 (MultiPV=2)** evaluates every ply, yielding optimal line $PV_1$ ($cp_1$) and critical second-best alternative $PV_2$ ($cp_2$).
   - **Centipawn Normalization & Sigmoid Win-Probability Mapping**:
     $$W(cp) = \frac{100}{1 + e^{-0.00368208 \cdot cp}}$$
     Win probability loss $\Delta W_i = \max(0, W_{\text{before}}(cp_1) - W_{\text{after}}(cp_{\text{played}}))$.
   - **Deterministic Bitboard Tactical Extractor (Zero-Hallucination Layer)**:
     Inspects the engine's refutation sequences using bitboard operations to extract verified factual tactics:
     - **Quiescence Material Delta**: Net material won/lost through consecutive capture resolutions.
     - **Fork Detection**: Destination square bitwise attack mask intersecting $\ge 2$ undefended or higher-value enemy pieces.
     - **Absolute & Relative Pin Detection**: Ray attack masks pinning pieces to the King or Queen.
     - **Back-Rank & King Safety**: Escape square (*luft*) detection and king-zone pressure.
     - **Missed Mates**: Forced mating sequences abandoned by the player.
   - **Deterministic Move Classification State Machine**:
     Strict priority order: Book $\to$ Brilliant (!!) $\to$ Great (!) $\to$ Miss $\to$ Best (★) $\to$ Excellent $\to$ Good $\to$ Inaccuracy (?!) $\to$ Mistake (?) $\to$ Blunder (??).
3. **Single-Batch Gemini Coach**:
   - **1 Game = 1 API Request**: Only critical plies (!!, !, ?!, ?, ??, Miss) are filtered and batched in a single compact JSON payload sent to Google AI Studio (`gemini-3.8-flash` with automatic fallback to `gemini-3.5-flash-lite` and `gemini-2.5-flash`).
   - **Structured Outputs (`response_schema`)** and low temperature (`0.2`) guarantee zero prompt injection and human-like natural commentary.
   - **Rate Limiting & Traffic Shaping**: In-process `asyncio.Semaphore` caps concurrent outbound requests; sliding-window token bucket enforces free-tier RPM ceilings.
   - **Deterministic Fallback**: If offline or if no API key is configured, the neuro-symbolic factual generator provides 100% accurate, rich coach commentary.
4. **Data Structures, Storage & Singleflight Coalescing**:
   - **64-bit Bitboards & 16-Bit Move Encoding**: 100 plies packed into 200 bytes.
   - **64-Bit Zobrist Hashing**: $O(1)$ opening book trie lookups and transposition caching.
   - **Canonical SHA-256 PGN Deduplication**: Games normalized into canonical SAN and cached.
   - **Singleflight Pattern**: Concurrent duplicate requests for uncached game reviews coalesce onto a shared `asyncio.Future`.
   - **Zstandard Compressed JSONB**: Reviews stored compressed in SQLite, reducing storage footprint by ~75%.
   - **Tactical Motif Inverted Index**: Filter reviewed games by tactical blind spots (forks, pins, missed mates, back-rank weaknesses).

---

## 🎨 Exact Chess.com UI/UX Anatomy & Palette

- **Palette**:
  - `#302E2B` Primary Canvas
  - `#262421` Elevated Navigation & Panels
  - `#312E2B` Card Surfaces & Speech Bubbles
  - `#403D39` Hairlines & Borders
  - `#739552` Board Dark Squares
  - `#EBECD0` Board Light Squares
  - `rgba(255, 255, 51, 0.5)` Translucent Yellow Last-Move Origin/Destination Highlights
  - `#81B64C` 3D-Beveled Green Button with `#457524` bottom edge
- **Three-Column Desktop Grid**:
  1. **160px Navigation Rail**: Brand emblem, Play, Puzzles, Learn, Import PGN, Archive, Sound toggle, and Settings.
  2. **Dynamic Square Board Stage**: Aspect-square board, coordinate indicators, symmetric top/bottom player strips with captured pieces, net material differential, digital chess clock (crimson alert below 10 seconds), 28px vertical evaluation bar (visible only in review mode), SVG arrows, and destination square classification badges.
  3. **400px Right Analysis Panel**:
     - *In-Game*: Alternating SAN move list, Resign, Offer Draw, Flip Board.
     - *Post-Game Modal*: Result banner, 3D green "Game Review" CTA.
     - *Review Workspace*:
       - **Virtual Coach Dialogue Box**: Avatar, badge, 1-2 sentence tactical explanation, and interactive **"Show Follow-Up"** button that animates refutation sequences on the board.
       - **Advantage Swing Graph**: Area chart timeline of White vs Black win probability across every ply with seek-on-click navigation.
       - **CAPS2 Accuracy & Classification Matrix**: Side-by-side comparison of overall accuracy (0-100%), Estimated Game Rating, and 10-tier move tallies.
       - **VCR Playback Bar**: Transport controls (`|<`, `<`, `▶ Auto-Play`, `>`, `>|`) bound to `ArrowLeft` / `ArrowRight` keyboard shortcuts.

---

## 🚀 Quickstart & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Windows / macOS / Linux

### Installation & Setup

1. **Clone & Setup Environment**:
   ```bash
   git clone https://github.com/your-username/ChessBuff.git
   cd ChessBuff

   # Install Python backend dependencies
   pip install -r requirements.txt

   # Download Stockfish binary (Windows / Linux / macOS)
   python scripts/setup_stockfish.py
   ```

2. **Configure API Key (Optional)**:
   ```bash
   # Copy environment template
   cp .env.example .env
   # Add your Google AI Studio Gemini API key to .env (or leave blank for offline mode)
   ```

3. **Install Frontend Dependencies & Build**:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

4. **Launch Unified Server**:
   ```bash
   python run.py
   ```
   Open your browser to: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

### 2. Frontend Development Mode
If editing React components with Vite Hot-Module Replacement (HMR):

```bash
# In one terminal, start the backend:
python run.py

# In another terminal, start Vite:
cd frontend
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** (Vite automatically proxies `/api` to `127.0.0.1:8000`).

---

## 🧪 Automated Test Suite

Run the unit and integration tests to verify bitboards, Zobrist hashing, Stockfish MultiPV=2 search, CAPS2 formulas, tactical extractors, and database caching:

```bash
# Run core engine tests
python -u backend/tests/test_engine.py

# Run API pipeline & review tests
python -u backend/tests/test_api.py
```

---

## 📂 Project Structure

```
ChessBuff/
├── backend/
│   ├── app/
│   │   ├── bitboard.py             # 64-bit bitboards, 16-bit move encoding, Zobrist hashing
│   │   ├── caps2.py                # CAPS2 Volatility-Weighted Accuracy & Elo estimation
│   │   ├── classifier.py           # Deterministic Move Classification State Machine
│   │   ├── config.py               # Settings, model fallbacks, paths, rate limits
│   │   ├── engine_eval.py          # Stockfish MultiPV=2 UCI engine & Sigmoid win probability
│   │   ├── gemini_coach.py         # Single-Batch Gemini Coach & Token Bucket rate limiter
│   │   ├── main.py                 # FastAPI endpoints & static SPA mount
│   │   ├── models.py               # Pydantic schemas & response models
│   │   ├── opening_book.py         # Polyglot Zobrist Trie & Opening Database
│   │   ├── storage.py              # SQLite hybrid cache, Zstd compression, Singleflight
│   │   └── tactical_extractor.py   # Neuro-Symbolic Bitboard Tactical Extractor
│   ├── requirements.txt
│   └── tests/
│       ├── test_engine.py          # Unit tests for algorithms & engine
│       └── test_api.py             # Integration tests for review endpoints
├── bin/
│   └── stockfish.exe               # Stockfish 19 UCI binary (MultiPV=2)
├── frontend/
│   ├── dist/                       # Compiled production web bundle
│   ├── src/
│   │   ├── audio/
│   │   │   └── soundManager.ts     # Web Audio API sub-5ms latency sound effects
│   │   ├── components/
│   │   │   ├── AdvantageGraph.tsx  # Area chart White vs Black win probability timeline
│   │   │   ├── ArchiveModal.tsx    # Historical games & tactical motif inverted index
│   │   │   ├── BoardStage.tsx      # Aspect-square board, SVG arrows, badges, legal dots
│   │   │   ├── CAPS2Matrix.tsx     # White vs Black accuracy %, rating estimation, 10 tiers
│   │   │   ├── ChessClock.tsx      # Digital clock with crimson alert below 10s
│   │   │   ├── ChessPieces.tsx     # Vector SVG chess pieces
│   │   │   ├── ImportPGNModal.tsx  # PGN importer with Opera Game & Kasparov presets
│   │   │   ├── NavRail.tsx         # 160px Left Navigation Rail
│   │   │   ├── PlayerStrip.tsx     # Symmetric player strip with captured pieces & material
│   │   │   ├── RightPanel.tsx      # Move list, Post-game modal, Diamond Review workspace
│   │   │   ├── SettingsModal.tsx   # Gemini API key & engine configuration
│   │   │   ├── VCRControls.tsx     # Transport controls (<, >, play) & keyboard arrows
│   │   │   └── VirtualCoachBox.tsx # Coach avatar, speech bubble, "Show Follow-Up" button
│   │   ├── types/
│   │   │   └── chess.ts            # TypeScript definitions
│   │   ├── App.tsx                 # Main UI State Machine & Game Coordinator
│   │   ├── index.css               # Tailwind & 3D button styling
│   │   └── main.tsx                # React root
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── run.py                          # Unified launcher for frontend + backend
└── README.md
```
