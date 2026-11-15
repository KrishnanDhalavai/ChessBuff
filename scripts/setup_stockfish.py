#!/usr/bin/env python3
"""
Cross-platform Stockfish downloader script for ChessBuff.
Downloads and extracts the official Stockfish binary into the bin/ directory.
Usage: python scripts/setup_stockfish.py
"""

import os
import sys
import platform
import zipfile
import tarfile
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BIN_DIR = BASE_DIR / "bin"
BIN_DIR.mkdir(parents=True, exist_ok=True)

def download_and_extract():
    system = platform.system().lower()
    machine = platform.machine().lower()

    print(f"[*] Detected OS: {system} ({machine})")

    if system == "windows":
        target_binary = BIN_DIR / "stockfish.exe"
        if target_binary.exists():
            print(f"[+] Stockfish binary already exists at {target_binary}")
            return

        url = "https://github.com/official-stockfish/Stockfish/releases/download/sf_17/stockfish-windows-x86-64-universal.zip"
        archive_path = BIN_DIR / "stockfish.zip"

        print(f"[*] Downloading Stockfish for Windows from {url}...")
        urllib.request.urlretrieve(url, archive_path)

        print("[*] Extracting stockfish.exe...")
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            for member in zip_ref.namelist():
                if member.endswith(".exe"):
                    source = zip_ref.open(member)
                    with open(target_binary, "wb") as target:
                        target.write(source.read())
                    break

        if archive_path.exists():
            archive_path.unlink()

        print(f"[+] Successfully installed Stockfish to {target_binary}")

    elif system == "linux":
        target_binary = BIN_DIR / "stockfish"
        if target_binary.exists():
            print(f"[+] Stockfish binary already exists at {target_binary}")
            return

        url = "https://github.com/official-stockfish/Stockfish/releases/download/sf_17/stockfish-ubuntu-x86-64-avx2.tar"
        archive_path = BIN_DIR / "stockfish.tar"

        print(f"[*] Downloading Stockfish for Linux from {url}...")
        urllib.request.urlretrieve(url, archive_path)

        with tarfile.open(archive_path, 'r') as tar_ref:
            for member in tar_ref.getmembers():
                if "stockfish" in member.name and member.isfile():
                    source = tar_ref.extractfile(member)
                    if source:
                        target_binary.write_bytes(source.read())
                        target_binary.chmod(0o755)
                    break

        if archive_path.exists():
            archive_path.unlink()

        print(f"[+] Successfully installed Stockfish to {target_binary}")

    elif system == "darwin":
        print("[*] On macOS, we recommend installing via Homebrew: brew install stockfish")
        print("[*] ChessBuff will automatically detect stockfish in your PATH.")

    else:
        print(f"[!] Unsupported automatic download for system: {system}.")
        print("[*] Please download Stockfish manually and place it in the bin/ directory or your PATH.")

if __name__ == "__main__":
    download_and_extract()
