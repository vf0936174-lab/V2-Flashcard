// src/services/storageService.js
// Simple async wrapper around localStorage for now.
// Replace implementation with IndexedDB or remote sync later.

const PREFIX = 'V2 Flashcard:';

export async function save(key, value) {
  try {
    const k = PREFIX + key;
    const v = JSON.stringify(value);
    localStorage.setItem(k, v);
    return true;
  } catch (err) {
    console.error('storageService.save error', err);
    return false;
  }
}

export async function load(key, fallback = null) {
  try {
    const k = PREFIX + key;
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error('storageService.load error', err);
    return fallback;
  }
}

export async function remove(key) {
  try {
    const k = PREFIX + key;
    localStorage.removeItem(k);
    return true;
  } catch (err) {
    console.error('storageService.remove error', err);
    return false;
  }
}

export async function listKeys() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(PREFIX)) {
        keys.push(fullKey.replace(PREFIX, ''));
      }
    }
    return keys;
  } catch (err) {
    console.error('storageService.listKeys error', err);
    return [];
  }
}

