// Raw-text keyword extraction for the confirmed-fix search feature
// (GET /api/repairs/search). Deliberately separate from diagnosis.js's
// extractSymptomKeywords, which is hardcoded to a couple of pre-classified
// categories (brake, won't-start) to ground AI diagnosis prompts — that
// function stays untouched here to avoid any regression risk to it. A search
// feature needs to handle whatever the user actually typed, not just the
// categories that function happens to recognize.

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "when", "have", "has",
  "que", "con", "para", "los", "las", "del", "una", "uno", "esta", "esto", "cuando", "tiene",
]);

export function extractSearchKeywords(text) {
  return [...new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9áéíóúñ]+/i)
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word)),
  )];
}
