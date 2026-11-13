import { parseCatalogId, toCatalogId } from './catalog-id';

describe('catalog ids', () => {
  it('builds provider-scoped ids', () => {
    expect(toCatalogId('deezer', 123)).toBe('deezer:123');
    expect(toCatalogId('youtube', 'abc')).toBe('youtube:abc');
  });

  it('parses namespaced ids', () => {
    expect(parseCatalogId('youtube:abc')).toEqual({
      provider: 'youtube',
      externalId: 'abc',
    });
  });

  it('treats legacy bare ids as Deezer', () => {
    expect(parseCatalogId('6516139')).toEqual({
      provider: 'deezer',
      externalId: '6516139',
    });
    expect(parseCatalogId(6516139)).toEqual({
      provider: 'deezer',
      externalId: '6516139',
    });
  });

  it('rejects empty and malformed ids', () => {
    expect(parseCatalogId('')).toBeNull();
    expect(parseCatalogId(null)).toBeNull();
    expect(parseCatalogId('Bad Provider:1')).toBeNull();
    expect(parseCatalogId('youtube:')).toBeNull();
    expect(() => toCatalogId('youtube', '')).toThrow();
  });
});
