import { normalizeCatalogItem } from './catalog-normalize';

describe('normalizeCatalogItem', () => {
  it('keeps an existing provider-scoped id', () => {
    const item = normalizeCatalogItem({ id: 'youtube:abc' });
    expect(item.provider).toBe('youtube');
    expect(item.externalId).toBe('abc');
    expect(item.id).toBe('youtube:abc');
  });

  it('defaults missing providers to Deezer', () => {
    const item = normalizeCatalogItem({ id: '6516139' });
    expect(item.provider).toBe('deezer');
    expect(item.externalId).toBe('6516139');
    expect(item.id).toBe('deezer:6516139');
  });

  it('prefers an explicit provider and external id', () => {
    const item = normalizeCatalogItem({
      id: '123',
      provider: 'youtube',
      externalId: 'abc',
    });
    expect(item.id).toBe('youtube:abc');
  });
});
