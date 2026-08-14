"use client";

// Efeito sonoro de "moeda" — toca /public/sounds/coin.mp3, chamado ao
// confirmar um cadastro (despesa, conta, compra, renda...).

let coinAudio: HTMLAudioElement | null = null;

function getCoinAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!coinAudio) {
    coinAudio = new Audio("/sounds/coin.mp3");
    coinAudio.preload = "auto";
  }
  return coinAudio;
}

/** Toca o som de moeda — chame ao confirmar um cadastro. */
export function playCoinSound() {
  const audio = getCoinAudio();
  if (!audio) return;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}
