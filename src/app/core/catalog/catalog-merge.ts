import { Track } from '../../shared/models/track.model';

/**
 * Trailing edition markers that should not prevent two catalogs from matching
 * the same release: "(Deluxe Edition)", "[Remastered 2011]", "- Bonus Track".
 */
const EDITION_MARKER_RE =
  /[\s]*[([][^)\]]*\b(remaster(?:ed)?|deluxe|edition|anniversary|bonus|explicit|expanded|special)\b[^)\]]*[)\]]/gi;

const EDITION_SUFFIX_RE =
  /\s*[-–—]\s*(?:remaster(?:ed)?|deluxe|bonus track|special edition)\s*$/gi;

/**
 * Comparison form of a name: no accents, no case, no punctuation, no edition
 * markers. "Daft Punk" and "DaftPunk" stay different; "Album" and
 * "Album (Deluxe Edition)" match.
 */
export function normalizeCatalogName(value: string | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(EDITION_MARKER_RE, ' ')
    .replace(EDITION_SUFFIX_RE, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Identity of an item across providers. Tracks and videos are matched by title
 * and main artist; releases by title and artist; artists by name. The type is
 * part of the key so an album, a song and a video sharing a name are never
 * collapsed.
 */
export function catalogMergeKey(item: Track): string {
  const name = normalizeCatalogName(item.name);
  if (item.type === 'artist') return `artist:${name}`;

  const artist = normalizeCatalogName(item.artists?.[0]);
  return `${item.type}:${artist}:${name}`;
}

/**
 * Merges result groups in priority order: the first catalog to return an item
 * owns its id and provider, later catalogs only fill the fields it lacks
 * (cover, preview, artist/album link, duration). Ids therefore stay stable
 * between searches, which keeps the wishlist and favorites free of duplicates.
 *
 * Two records returned by the *same* catalog are never collapsed: providers
 * carry distinct artist records with identical names (and sometimes distinct
 * releases), and merging them would hide the one the user saved. Deezer is
 * currently the only searchable catalog; the function keeps its cross-catalog
 * shape so a second catalog can be added without changing ids.
 */
export function mergeCatalogResults(groups: readonly Track[][]): Track[] {
  const merged: Track[] = [];
  const position = new Map<string, number>();

  for (const group of groups) {
    for (const item of group) {
      if (!item?.name) continue;

      const key = catalogMergeKey(item);
      const existing = position.get(key);

      if (existing === undefined) {
        position.set(key, merged.length);
        merged.push(item);
        continue;
      }

      // Same provider: a different record that happens to share the name.
      if (item.provider && item.provider === merged[existing].provider) {
        merged.push(item);
        continue;
      }

      merged[existing] = fillMissingFields(merged[existing], item);
    }
  }

  return merged;
}

const FILLABLE_FIELDS = [
  'coverUrl',
  'previewUrl',
  'artistId',
  'albumId',
  'albumName',
  'fanCount',
  'albumCount',
] as const;

function fillMissingFields(winner: Track, donor: Track): Track {
  const patch: Partial<Pick<Track, (typeof FILLABLE_FIELDS)[number]>> = {};

  for (const field of FILLABLE_FIELDS) {
    const current = winner[field];
    const value = donor[field];
    const missing =
      current === undefined || current === null || current === '';
    if (missing && value !== undefined && value !== null && value !== '') {
      patch[field] = value as never;
    }
  }

  if (!winner.artists?.length && donor.artists?.length) {
    return { ...winner, ...patch, artists: donor.artists };
  }

  return Object.keys(patch).length > 0 ? { ...winner, ...patch } : winner;
}
