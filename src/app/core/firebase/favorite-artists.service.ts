import {
  Injectable,
  computed,
  inject,
  signal,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
} from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';
import { SearchService } from '../api/search.service';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { LanguageService } from '../i18n/language.service';

export interface FavoriteArtist {
  id?: string;
  artistId: string;
  name: string;
  image?: string;
  addedAt: number;
  addedBy: string;
  addedByUid: string;
}

@Injectable({ providedIn: 'root' })
export class FavoriteArtistsService {
  private firestore = inject(Firestore);
  private search = inject(SearchService);
  private injector = inject(Injector);
  private toastService = inject(ToastService);
  private lang = inject(LanguageService);

  private _artists = signal<FavoriteArtist[]>([]);
  artists = this._artists.asReadonly();

  artistIds = computed(() => new Set(this._artists().map((a) => a.artistId)));

  private unsubscribe: (() => void) | null = null;
  private isDemoMode = false;

  initListener(uid: string): void {
    if (this.unsubscribe) return;

    runInInjectionContext(this.injector, () => {
      const auth = inject(AuthService);
      this.isDemoMode = auth.demoMode();

      if (this.isDemoMode) {
        this.initLocalStorage(uid);
        return;
      }

      const col = collection(this.firestore, 'favorite-artists');
      const q = query(
        col,
        where('addedByUid', '==', uid),
        orderBy('addedAt', 'desc'),
      );

      this.unsubscribe = onSnapshot(q, async (snap) => {
        let artists = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as FavoriteArtist,
        );

        artists = await Promise.all(
          artists.map(async (artist) => {
            if (!artist.image || !artist.image.trim()) {
              try {
                const data = await this.search
                  .getArtist(artist.artistId)
                  .toPromise();
                return {
                  ...artist,
                  image:
                    data?.picture_big ?? data?.picture_medium ?? artist.image,
                };
              } catch {
                return artist;
              }
            }
            return artist;
          }),
        );

        this._artists.set(artists);
      });
    });
  }

  private initLocalStorage(uid: string): void {
    const key = `favorite-artists-${uid}`;
    const stored = localStorage.getItem(key);
    const artists: FavoriteArtist[] = stored ? JSON.parse(stored) : [];
    this._artists.set(artists);
  }

  stopListener(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this._artists.set([]);
  }

  async add(
    artistId: string,
    artistName: string,
    image: string | undefined,
    user: User,
  ): Promise<void> {
    const entry: Omit<FavoriteArtist, 'id'> = {
      artistId,
      name: artistName,
      image,
      addedAt: Date.now(),
      addedBy: user.displayName ?? user.email ?? 'Anónimo',
      addedByUid: user.uid,
    };

    try {
      if (this.isDemoMode) {
        const key = `favorite-artists-${user.uid}`;
        const stored = localStorage.getItem(key);
        const artists: FavoriteArtist[] = stored ? JSON.parse(stored) : [];
        const newArtist: FavoriteArtist = { id: Date.now().toString(), ...entry };
        artists.unshift(newArtist);
        localStorage.setItem(key, JSON.stringify(artists));
        this._artists.set(artists);
      } else {
        await runInInjectionContext(this.injector, () => {
          const col = collection(this.firestore, 'favorite-artists');
          return addDoc(col, entry);
        });
      }
      this.toastService.success(
        this.lang.t().toastFavoriteAdded,
        this.lang.t().toastFavoriteAddedPlural,
      );
    } catch {
      this.toastService.error(this.lang.t().toastError, this.lang.t().toastErrorPlural);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      if (this.isDemoMode) {
        const current = this._artists();
        const updated = current.filter((a) => a.id !== id);
        this._artists.set(updated);

        if (updated.length >= 0) {
          const storedUid = localStorage.getItem('last_uid') || '';
          const key = `favorite-artists-${storedUid}`;
          localStorage.setItem(key, JSON.stringify(updated));
        }
      } else {
        await runInInjectionContext(this.injector, () => {
          const docRef = doc(this.firestore, 'favorite-artists', id);
          return deleteDoc(docRef);
        });
      }
      this.toastService.success(
        this.lang.t().toastFavoriteRemoved,
        this.lang.t().toastFavoriteRemovedPlural,
      );
    } catch {
      this.toastService.error(this.lang.t().toastError, this.lang.t().toastErrorPlural);
    }
  }
}
