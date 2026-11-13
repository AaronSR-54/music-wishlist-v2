import {
  Injectable,
  computed,
  inject,
  signal,
  effect,
  runInInjectionContext,
  Injector,
} from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';
import { Track } from '../../shared/models/track.model';
import { AuthService } from '../auth/auth.service';
import { FavoriteArtist } from '../../shared/models/favorite.artist.model';
import { parseCatalogId, toCatalogId } from '../catalog/catalog-id';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private firestore = inject(Firestore);
  private authSvc = inject(AuthService);
  private injector = inject(Injector);

  private _favorites = signal<FavoriteArtist[]>([]);
  favorites = this._favorites.asReadonly();

  artistIds = computed(() => new Set(this._favorites().map((f) => f.artistId)));

  private unsubscribeFn: (() => void) | null = null;

  constructor() {
    effect(() => {
      const inDemoMode = this.authSvc.demoMode();
      const user = this.authSvc.currentUser();

      if (this.unsubscribeFn) this.unsubscribeFn();
      this._favorites.set([]);

      if (!user) {
        return;
      }

      if (inDemoMode) {
        this.loadFromLocalStorage(user.uid);
        return;
      }

      runInInjectionContext(this.injector, () => {
        const col = collection(this.firestore, 'favorite-artists');
        const q = query(
          col,
          where('addedByUid', '==', user.uid),
          orderBy('addedAt', 'desc'),
        );

        this.unsubscribeFn = onSnapshot(q, (snap) => {
          this._favorites.set(
            snap.docs.map((d) =>
              this.normalizeArtist({ id: d.id, ...d.data() } as FavoriteArtist),
            ),
          );
        });
      });
    });
  }

  private loadFromLocalStorage(uid: string): void {
    const key = `favorite-artists-${uid}`;
    const stored = localStorage.getItem(key);
    const artists: FavoriteArtist[] = stored ? JSON.parse(stored) : [];
    this._favorites.set(artists.map((artist) => this.normalizeArtist(artist)));
  }

  private normalizeArtist(artist: FavoriteArtist): FavoriteArtist {
    const parsed = parseCatalogId(artist.artistId, artist.provider);
    const provider = artist.provider ?? parsed?.provider ?? 'deezer';
    const externalId = artist.externalId ?? parsed?.externalId ?? artist.artistId;
    return {
      ...artist,
      provider,
      externalId,
      artistId: toCatalogId(provider, externalId),
    };
  }

  async add(track: Track, user: User): Promise<void> {
    const artistRef = track.artistId ?? track.id;
    const parsed = parseCatalogId(artistRef, track.provider);
    const provider = parsed?.provider ?? track.provider ?? 'deezer';
    const externalId = parsed?.externalId ?? artistRef;
    const entry: Omit<FavoriteArtist, 'id'> = {
      artistId: toCatalogId(provider, externalId),
      externalId,
      provider,
      name: track.name,
      coverUrl: track.coverUrl,
      addedAt: Date.now(),
      addedByUid: user.uid,
    };

    await runInInjectionContext(this.injector, async () => {
      const col = collection(this.firestore, 'favorite-artists');
      await addDoc(col, entry);
    });
  }

  async remove(artistId: string): Promise<void> {
    const docToDelete = this._favorites().find((f) => f.artistId === artistId);
    if (docToDelete?.id) {
      await deleteDoc(doc(this.firestore, 'favorite-artists', docToDelete.id));
    }
  }
}
