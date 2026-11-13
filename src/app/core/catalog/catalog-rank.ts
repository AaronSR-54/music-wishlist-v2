import { Track } from '../../shared/models/track.model';
import { normalizeCatalogName } from './catalog-merge';

/**
 * Search ranking.
 *
 * Two things decide the order:
 *
 * 1. How well the name matches the query: exact, prefix, every query word,
 *    contained, or a typo-level fuzzy match.
 * 2. How much audience the item has (followers / albums), in log10 units, so
 *    one point means "10x bigger".
 *
 * The match weights are expressed in those same units. An exact match is worth
 * 4 points over a prefix match, i.e. a prefix artist needs roughly 10,000x the
 * audience to win. That is what keeps a niche but exactly-named artist on top,
 * while still letting "Taylor Swift" beat an obscure artist literally named
 * "Taylor" when the user types "taylor".
 *
 * Name matches always outrank items that do not match the name at all: even a
 * borderline fuzzy match (~9) sits above the most followed artist in the world
 * (~8.9).
 */
const MATCH_EXACT = 20;
const MATCH_PREFIX = 16;
const MATCH_TOKEN_PREFIX = 13;
const MATCH_CONTAINS = 11;
const MATCH_FUZZY = 11;

/** Below this similarity a fuzzy match is noise, not a typo. */
const FUZZY_THRESHOLD = 0.82;

/**
 * Being saved by the user is worth up to ~100x followers over another record
 * with a comparable name. It never beats a much better name match.
 */
const PREFERRED_BOOST = 2;

/** Name-match quality for a query, in "log audience" points (0 = no match). */
export function matchQuality(name: string, query: string): number {
  const target = normalizeCatalogName(name);
  const search = normalizeCatalogName(query);
  if (!target || !search) return 0;

  if (target === search) return MATCH_EXACT;

  const words = target.split(' ');
  const searchWords = search.split(' ');

  if (target.startsWith(`${search} `)) return MATCH_PREFIX;

  // Every word typed starts a word of the name, in any order
  // ("swift taylor" -> "Taylor Swift").
  if (
    searchWords.every((token) =>
      words.some((word) => word.startsWith(token)),
    )
  ) {
    return MATCH_TOKEN_PREFIX;
  }

  if (target.includes(search)) return MATCH_CONTAINS;

  const similarity = bestSimilarity(search, target, words);
  return similarity >= FUZZY_THRESHOLD ? MATCH_FUZZY * similarity : 0;
}

/** Audience size in log10 units: 1 follower is ~0, 1M is ~6, 10M is ~7. */
export function popularityScore(item: Track): number {
  const fans = item.fanCount ?? 0;
  const albums = item.albumCount ?? 0;
  return Math.log10(1 + fans) + 0.25 * Math.log10(1 + albums);
}

/**
 * Orders results by match quality and audience. Ties keep the order the
 * provider returned, which is already its own relevance order.
 */
export function rankCatalogResults(
  items: readonly Track[],
  query: string,
  preferredIds?: ReadonlySet<string>,
): Track[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score:
        matchQuality(item.name, query) +
        popularityScore(item) +
        (preferredIds?.has(item.id) ? PREFERRED_BOOST : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

function bestSimilarity(
  search: string,
  target: string,
  words: readonly string[],
): number {
  let best = similarity(search, target);
  const tokens = search.split(' ');

  for (const word of words) {
    // Exact and prefixed words were handled before reaching this point.
    if (word.startsWith(search) || search.startsWith(word)) continue;
    best = Math.max(best, similarity(search, word));
    for (const token of tokens) {
      best = Math.max(best, similarity(token, word));
    }
  }

  return best;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const longest = Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) / longest > 0.4) return 0;
  return 1 - levenshtein(a, b) / longest;
}

/** Iterative Levenshtein distance with two rows. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }

  return previous[b.length];
}
