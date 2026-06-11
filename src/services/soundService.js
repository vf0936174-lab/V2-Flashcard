// src/services/soundService.js

const registry = {};
let volume = 1.0;
let enabled = true;

export function initSoundManager(sounds = {}) {
  // sounds: { name: url }
  Object.keys(sounds).forEach((k) => {
    const audio = new Audio(sounds[k]);
    audio.preload = 'auto';
    audio.volume = volume;
    registry[k] = audio;
  });
}

export function registerSound(name, url) {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.volume = volume;
  registry[name] = audio;
}

export function playSound(name) {
  if (!enabled) return;
  const a = registry[name];
  if (!a) return;
  try {
    // clone to allow overlapping
    const clone = a.cloneNode();
    clone.volume = volume;
    clone.play().catch((e) => {
      // autoplay restrictions may block; ignore silently
      console.debug('soundService.playSound blocked', e);
    });
  } catch (err) {
    console.error('soundService.playSound error', err);
  }
}

export function stopAll() {
  Object.values(registry).forEach((a) => {
    try {
      a.pause();
      a.currentTime = 0;
    } catch (e) { /* ignore */ }
  });
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  Object.values(registry).forEach((a) => { a.volume = volume; });
}

export function enableSounds(flag = true) {
  enabled = !!flag;
}
