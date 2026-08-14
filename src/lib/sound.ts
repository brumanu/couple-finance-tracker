"use client";

// Efeito sonoro de "moeda" sintetizado via Web Audio API — sem arquivo de
// áudio nenhum, então não pesa no bundle nem tem questão de licença.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  peakGain: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

/** Toca um "cha-ching" curto de moeda — chame ao confirmar um cadastro. */
export function playCoinSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 1046.5, now, 0.16, 0.18); // C6
  playTone(ctx, 2093, now, 0.12, 0.05); // brilho (oitava acima)
  playTone(ctx, 1568, now + 0.07, 0.22, 0.16); // G6
  playTone(ctx, 3136, now + 0.07, 0.15, 0.04); // brilho
}
