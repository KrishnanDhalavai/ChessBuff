import base64
from pathlib import Path

sounds_dir = Path("frontend/public/sounds")
files = [
    "move.mp3",
    "capture.mp3",
    "check.mp3",
    "castle.mp3",
    "promote.mp3",
    "start.mp3",
    "end.mp3",
    "illegal.mp3",
]

lines = ["// Authentic Chess.com audio base64 data URIs", "export const CHESS_SOUNDS: Record<string, string> = {"]
for f in files:
    data = (sounds_dir / f).read_bytes()
    b64 = base64.b64encode(data).decode("utf-8")
    name = f.replace(".mp3", "")
    lines.append(f'  "{name}": "data:audio/mp3;base64,{b64}",')
lines.append("};")
lines.append("")

out_file = Path("frontend/src/audio/soundData.ts")
out_file.write_text("\n".join(lines), encoding="utf-8")
print(f"Generated {out_file} successfully! Size: {out_file.stat().st_size} bytes")
