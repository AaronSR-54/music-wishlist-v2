import {
  catalogMergeKey,
  mergeCatalogResults,
  normalizeCatalogName,
} from './catalog-merge';
import { Track } from '../../shared/models/track.model';

function item(overrides: Partial<Track> = {}): Track {
  return {
    id: 'deezer:1',
    provider: 'deezer',
    name: 'One More Time',
    artists: ['Daft Punk'],
    coverUrl: 'https://cover/1',
    type: 'track',
    uri: '',
    ...overrides,
  };
}

describe('catalog-merge', () => {
  it('normalizes accents, case, punctuation and edition markers', () => {
    expect(normalizeCatalogName('Daft Punk')).toBe('daft punk');
    expect(normalizeCatalogName('DAFT  PUNK!!')).toBe('daft punk');
    expect(normalizeCatalogName('Beyoncé')).toBe('beyonce');
    expect(normalizeCatalogName('Random Access Memories (Deluxe Edition)')).toBe(
      'random access memories',
    );
    expect(normalizeCatalogName('Discovery - Remastered')).toBe('discovery');
    expect(normalizeCatalogName('Album [Explicit]')).toBe('album');
  });

  it('builds identity keys by type and main artist', () => {
    expect(catalogMergeKey(item())).toBe('track:daft punk:one more time');
    expect(
      catalogMergeKey(item({ type: 'album', name: 'Discovery' })),
    ).toBe('album:daft punk:discovery');
    expect(
      catalogMergeKey(item({ type: 'artist', name: 'Daft Punk' })),
    ).toBe('artist:daft punk');

    // Same name, different kind or artist: different key.
    expect(catalogMergeKey(item({ type: 'album' }))).not.toBe(
      catalogMergeKey(item()),
    );
    expect(catalogMergeKey(item({ artists: ['Other'] }))).not.toBe(
      catalogMergeKey(item()),
    );
  });

  it('keeps a video apart from the same song', () => {
    const video = item({
      id: 'youtube:1',
      provider: 'youtube',
      type: 'video',
    });

    expect(catalogMergeKey(video)).toBe('video:daft punk:one more time');
    expect(catalogMergeKey(video)).not.toBe(catalogMergeKey(item()));
  });

  it('keeps distinct records returned by the same catalog', () => {
    const first = item({ id: 'deezer:1', name: 'Iban' });
    const second = item({ id: 'deezer:2', name: 'Iban' });

    const merged = mergeCatalogResults([[first, second]]);

    expect(merged.map((entry) => entry.id)).toEqual(['deezer:1', 'deezer:2']);
  });

  it('merges only across catalogs, not within one', () => {
    const deezerA = item({ id: 'deezer:1', name: 'Iban' });
    const deezerB = item({ id: 'deezer:2', name: 'Iban' });
    const youtube = item({
      id: 'youtube:9',
      provider: 'youtube',
      name: 'Ibán',
      previewUrl: 'https://preview/youtube.m4a',
    });

    const merged = mergeCatalogResults([[deezerA, deezerB], [youtube]]);

    // Both Deezer records stay; YouTube only completes the first one.
    expect(merged.map((entry) => entry.id)).toEqual(['deezer:1', 'deezer:2']);
    expect(merged[0].previewUrl).toBe('https://preview/youtube.m4a');
  });

  it('keeps the first catalog item and fills only what it lacks', () => {
    const deezer = item({ previewUrl: undefined, coverUrl: '' });
    const youtube = item({
      id: 'youtube:9',
      provider: 'youtube',
      previewUrl: 'https://preview/youtube.m4a',
      coverUrl: 'https://cover/youtube',
    });

    const [merged] = mergeCatalogResults([[deezer], [youtube]]);

    expect(merged.id).toBe('deezer:1');
    expect(merged.provider).toBe('deezer');
    expect(merged.previewUrl).toBe('https://preview/youtube.m4a');
    expect(merged.coverUrl).toBe('https://cover/youtube');
  });

  it('does not overwrite fields the winning item already has', () => {
    const deezer = item({
      previewUrl: 'https://preview/deezer.mp3',
      coverUrl: 'https://cover/deezer',
    });
    const youtube = item({
      id: 'youtube:9',
      provider: 'youtube',
      previewUrl: 'https://preview/youtube.m4a',
      coverUrl: 'https://cover/youtube',
    });

    const [merged] = mergeCatalogResults([[deezer], [youtube]]);

    expect(merged.previewUrl).toBe('https://preview/deezer.mp3');
    expect(merged.coverUrl).toBe('https://cover/deezer');
  });

  it('merges the same album despite a deluxe edition marker', () => {
    const deezer = item({ type: 'album', name: 'Random Access Memories' });
    const youtube = item({
      id: 'youtube:9',
      provider: 'youtube',
      type: 'album',
      name: 'Random Access Memories (Deluxe Edition)',
    });

    const merged = mergeCatalogResults([[deezer], [youtube]]);

    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe('deezer:1');
  });

  it('keeps remixes, live versions and different artists apart', () => {
    const merged = mergeCatalogResults([
      [
        item(),
        item({ id: 'deezer:2', name: 'One More Time (Remix)' }),
        item({ id: 'deezer:3', name: 'One More Time - Live' }),
      ],
      [item({ id: 'youtube:9', provider: 'youtube', artists: ['Other'] })],
    ]);

    expect(merged.length).toBe(4);
  });

  it('keeps the order of first appearance', () => {
    const merged = mergeCatalogResults([
      [item({ id: 'deezer:1', name: 'A' }), item({ id: 'deezer:2', name: 'B' })],
      [item({ id: 'youtube:1', provider: 'youtube', name: 'C' })],
    ]);

    expect(merged.map((entry) => entry.id)).toEqual([
      'deezer:1',
      'deezer:2',
      'youtube:1',
    ]);
  });
});
