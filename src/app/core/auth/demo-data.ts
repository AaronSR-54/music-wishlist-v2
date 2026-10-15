// Demo credentials and sample data for the local demo session.
// Used by the reviewer/demo login (username + password) and `?demo`.
export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = '1234';

export function seedDemoData(): void {
  if (typeof localStorage === 'undefined') return;

  const wishlistKey = 'wishlist-demo-user';
  const favoritesKey = 'favorite-artists-demo-user';
  const now = Date.now();

  if (!localStorage.getItem(wishlistKey)) {
    localStorage.setItem(
      wishlistKey,
      JSON.stringify([
        {
          id: '1',
          trackId: '66609426',
          name: 'Get Lucky (Radio Edit)',
          artist: 'Daft Punk',
          coverUrl: 'https://api.deezer.com/album/6516139/image',
          type: 'track',
          addedAt: now,
          addedBy: 'Demo User',
          addedByUid: 'demo-user',
          downloaded: false,
          sharedWith: [],
          artistId: '27',
        },
        {
          id: '2',
          trackId: '302127',
          name: 'Discovery',
          artist: 'Daft Punk',
          coverUrl: 'https://api.deezer.com/album/302127/image',
          type: 'album',
          addedAt: now - 1000,
          addedBy: 'Demo User',
          addedByUid: 'demo-user',
          downloaded: false,
          sharedWith: [],
          artistId: '27',
          albumId: '302127',
        },
        {
          id: '3',
          trackId: '67238732',
          name: 'Instant Crush',
          artist: 'Daft Punk',
          coverUrl: 'https://api.deezer.com/album/6575789/image',
          type: 'track',
          addedAt: now - 2000,
          addedBy: 'Demo User',
          addedByUid: 'demo-user',
          downloaded: true,
          sharedWith: [],
          artistId: '27',
        },
      ]),
    );
  }

  if (!localStorage.getItem(favoritesKey)) {
    localStorage.setItem(
      favoritesKey,
      JSON.stringify([
        {
          id: '1',
          artistId: '27',
          name: 'Daft Punk',
          coverUrl: 'https://api.deezer.com/artist/27/image',
          addedAt: now,
          addedByUid: 'demo-user',
        },
        {
          id: '2',
          artistId: '4050205',
          name: 'The Weeknd',
          coverUrl: 'https://api.deezer.com/artist/4050205/image',
          addedAt: now - 1000,
          addedByUid: 'demo-user',
        },
      ]),
    );
  }
}
