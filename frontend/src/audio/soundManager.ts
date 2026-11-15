import { CHESS_SOUNDS } from './soundData';

function base64ToArrayBuffer(base64Uri: string): ArrayBuffer {
  const base64 = base64Uri.split(',')[1];
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  public isMuted: boolean = false;
  private initialized: boolean = false;

  constructor() {
    // Eagerly prepare HTMLAudioElement fallbacks
    try {
      for (const [name, uri] of Object.entries(CHESS_SOUNDS)) {
        const audio = new Audio(uri);
        audio.preload = 'auto';
        this.audioElements.set(name, audio);
      }
    } catch (e) {
      // Audio element creation error fallback
    }
  }

  private initContext() {
    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;

      // Decode authentic Chess.com sound files
      for (const [name, uri] of Object.entries(CHESS_SOUNDS)) {
        try {
          const arrayBuffer = base64ToArrayBuffer(uri);
          this.ctx.decodeAudioData(
            arrayBuffer,
            (decoded) => {
              this.buffers.set(name, decoded);
            },
            (err) => {
              console.warn(`[SoundManager] Web Audio decode error for ${name}, using HTML5 fallback:`, err);
            }
          );
        } catch (err) {
          console.warn(`[SoundManager] ArrayBuffer conversion error for ${name}:`, err);
        }
      }
    } catch (e) {
      console.warn('[SoundManager] Web Audio API not supported, using HTML5 Audio:', e);
    }
  }

  public play(name: 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'start' | 'end' | 'illegal') {
    if (this.isMuted) return;

    this.initContext();

    // 1. Try Web Audio API Buffer (Ultra low latency < 2ms)
    if (this.ctx && this.buffers.has(name)) {
      try {
        const buf = this.buffers.get(name)!;
        const source = this.ctx.createBufferSource();
        source.buffer = buf;
        source.connect(this.ctx.destination);
        source.start(0);
        return;
      } catch (e) {
        // Fall back to HTML5 Audio
      }
    }

    // 2. HTML5 Audio fallback
    const audio = this.audioElements.get(name);
    if (audio) {
      try {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } catch (e) {
        // Audio playback suppressed or blocked
      }
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();
