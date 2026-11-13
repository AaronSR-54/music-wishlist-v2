import { catalogExportLine, catalogExternalUrl } from './catalog-link';

describe('catalog links', () => {
  it('builds Deezer item URLs from provider-scoped ids', () => {
    expect(
      catalogExternalUrl({ id: 'deezer:123', type: 'track' }),
    ).toBe('https://www.deezer.com/track/123');
    expect(
      catalogExternalUrl({ id: 'deezer:123', type: 'album' }),
    ).toBe('https://www.deezer.com/album/123');
  });

  it('builds YouTube watch links without a stored uri', () => {
    expect(
      catalogExternalUrl({ id: 'youtube:vid1', provider: 'youtube', type: 'track' }),
    ).toBe('https://www.youtube.com/watch?v=vid1');
    expect(
      catalogExternalUrl({ id: 'youtube:vid1', provider: 'youtube', type: 'video' }),
    ).toBe('https://www.youtube.com/watch?v=vid1');
  });

  it('builds YouTube playlist and channel links for albums and artists', () => {
    expect(
      catalogExternalUrl({ id: 'youtube:PL1', provider: 'youtube', type: 'album' }),
    ).toBe('https://www.youtube.com/playlist?list=PL1');
    expect(
      catalogExternalUrl({ id: 'youtube:UC1', provider: 'youtube', type: 'artist' }),
    ).toBe('https://www.youtube.com/channel/UC1');
  });

  it('only prefixes godeez for Deezer exports', () => {
    expect(catalogExportLine({ id: 'deezer:123', type: 'track' })).toBe(
      'godeez https://www.deezer.com/track/123',
    );
    expect(catalogExportLine({ id: 'youtube:vid1', provider: 'youtube', type: 'track' })).toBe(
      'https://www.youtube.com/watch?v=vid1',
    );
  });
});
