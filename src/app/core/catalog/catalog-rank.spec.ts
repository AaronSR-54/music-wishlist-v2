import { Track } from '../../shared/models/track.model';
import { matchQuality, rankCatalogResults } from './catalog-rank';

function artist(name: string, extra: Partial<Track> = {}): Track {
  return {
    id: `deezer:${name}`,
    provider: 'deezer',
    name,
    artists: [name],
    coverUrl: '',
    type: 'artist',
    uri: '',
    ...extra,
  };
}

describe('catalog-rank', () => {
  it('scores exact, prefix, token, contains and fuzzy matches by quality', () => {
    expect(matchQuality('Daft Punk', 'daft punk')).toBe(20);
    expect(matchQuality('Daft Punk', 'daft')).toBe(16);
    expect(matchQuality('Taylor Swift', 'swift taylor')).toBe(13);
    expect(matchQuality('Daft Punk Live', 'unk')).toBe(11);
    expect(matchQuality('Beyonce', 'beyonce')).toBe(20);
    expect(matchQuality('Taylor', 'taylr')).toBeGreaterThan(0);
    expect(matchQuality('Rihanna', 'iban')).toBe(0);
    expect(matchQuality('Exactly the same', '')).toBe(0);
  });

  it('keeps an exact artist above a slightly more followed prefix artist', () => {
    const exact = artist('Iban', { id: 'deezer:105607162', fanCount: 72, albumCount: 12 });
    const duplicate = artist('Iban', { id: 'deezer:385495151', fanCount: 9, albumCount: 4 });
    const prefix = artist('Iban Reus', { fanCount: 1186, albumCount: 4 });

    const ranked = rankCatalogResults([prefix, duplicate, exact], 'iban');

    expect(ranked.map((item) => item.id)).toEqual([
      'deezer:105607162',
      'deezer:385495151',
      'deezer:Iban Reus',
    ]);
  });

  it('puts a massively followed artist first even if the name is only a prefix', () => {
    const obscure = artist('Taylor', { fanCount: 2, albumCount: 1 });
    const swift = artist('Taylor Swift', { fanCount: 12_783_270, albumCount: 128 });

    const ranked = rankCatalogResults([obscure, swift], 'taylor');

    expect(ranked[0].name).toBe('Taylor Swift');
  });

  it('never lets an unmatched popular artist beat a name match', () => {
    const rihanna = artist('Rihanna', { fanCount: 18_167_861, albumCount: 99 });
    const typo = artist('Taylor', { fanCount: 0, albumCount: 0 });

    const ranked = rankCatalogResults([rihanna, typo], 'taylr');

    expect(ranked[0].name).toBe('Taylor');
  });

  it('ranks a saved artist above a comparable record', () => {
    const saved = artist('Iban', { id: 'deezer:105607162', fanCount: 0 });
    const other = artist('Iban', { id: 'deezer:385495151', fanCount: 90 });

    const ranked = rankCatalogResults(
      [other, saved],
      'iban',
      new Set(['deezer:105607162']),
    );

    expect(ranked[0].id).toBe('deezer:105607162');
  });

  it('keeps the provider order for equal scores', () => {
    const first = artist('Iban', { id: 'deezer:1' });
    const second = artist('Iban', { id: 'deezer:2' });

    const ranked = rankCatalogResults([first, second], 'iban');

    expect(ranked.map((item) => item.id)).toEqual(['deezer:1', 'deezer:2']);
  });

  it('sorts albums and videos by name match without audience data', () => {
    const album = artist('Discovery', { type: 'album' });
    const deluxe = artist('Discovery (Deluxe Edition)', { type: 'album' });
    const video = artist('Get Lucky', { type: 'video' });

    const ranked = rankCatalogResults([video, album, deluxe], 'discovery');

    expect(ranked.map((item) => item.type)).toEqual(['album', 'album', 'video']);
    expect(ranked[0].name).toBe('Discovery');
  });
});
