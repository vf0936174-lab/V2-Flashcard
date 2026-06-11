// src/services/aiService.js

export async function analyzeDeck(deck) {
  // Placeholder: return simple heuristics
  if (!deck) return { suggestions: [] };
  const suggestions = [];
  if ((deck.cards || []).length < 5) {
    suggestions.push({ type: 'add_cards', message: 'Consider adding more cards to reach at least 5 items.' });
  }
  // detect very long fronts/backs
  const longCards = (deck.cards || []).filter((c) => (c.front?.length || 0) > 200 || (c.back?.length || 0) > 400);
  if (longCards.length) {
    suggestions.push({ type: 'shorten_cards', message: `Found ${longCards.length} long cards. Shorter prompts improve recall.` });
  }
  return { suggestions, analyzedAt: new Date().toISOString() };
}

export async function generateQuestion(card) {
  // Placeholder: return a simple reformulation
  if (!card) return null;
  return {
    question: `What does "${card.front}" mean?`,
    generatedAt: new Date().toISOString()
  };
}
