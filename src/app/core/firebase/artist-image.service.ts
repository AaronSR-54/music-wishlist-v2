import {
  Injectable,
  inject,
  signal,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';

import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { LanguageService } from '../i18n/language.service';
import { parseCatalogId, toCatalogId } from '../catalog/catalog-id';

export interface ArtistImageOverride {
  id?: string;
  ownerUid: string;
  artistId: string;
  image: string;
  updatedAt: number;
}

/**
 * Per-user artist photos. Deezer's artist picture is often outdated or plain
 * wrong, so the user can replace it. The override lives in `artist-images`
 * (one document per artist and user) and wins over the catalog picture.
 */
@Injectable({ providedIn: 'root' })
export class ArtistImageService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private toastService = inject(ToastService);
  private lang = inject(LanguageService);

  private _images = signal<Record<string, string>>({});
  readonly images = this._images.asReadonly();

  private unsubscribe: (() => void) | null = null;
  private isDemoMode = false;
  private ownerUid: string | null = null;

  initListener(uid: string): void {
    if (this.unsubscribe) return;
    this.ownerUid = uid;

    runInInjectionContext(this.injector, () => {
      const auth = inject(AuthService);
      this.isDemoMode = auth.demoMode();

      if (this.isDemoMode) {
        this.initLocalStorage(uid);
        return;
      }

      const col = collection(this.firestore, 'artist-images');
      const q = query(col, where('ownerUid', '==', uid));

      this.unsubscribe = onSnapshot(q, (snap) => {
        const images: Record<string, string> = {};
        for (const document of snap.docs) {
          const data = document.data() as ArtistImageOverride;
          if (data.artistId && data.image) {
            images[this.normalizeId(data.artistId)] = data.image;
          }
        }
        this._images.set(images);
      });
    });
  }

  private initLocalStorage(uid: string): void {
    const stored = localStorage.getItem(`artist-images-${uid}`);
    if (!stored) {
      this._images.set({});
      return;
    }

    try {
      this._images.set(JSON.parse(stored) as Record<string, string>);
    } catch {
      this._images.set({});
    }
  }

  stopListener(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this._images.set({});
  }

  /** Custom photo for an artist, or null when the catalog picture is used. */
  imageFor(artistId: string): string | null {
    return this._images()[this.normalizeId(artistId)] ?? null;
  }

  hasOverride(artistId: string): boolean {
    return this.imageFor(artistId) !== null;
  }

  /** A resolved image for the artist: override first, then the given fallback. */
  resolve(artistId: string, fallback?: string): string {
    return this.imageFor(artistId) ?? fallback ?? '';
  }

  async setImage(
    artistId: string,
    image: string,
    user: User,
  ): Promise<boolean> {
    const id = this.normalizeId(artistId);
    if (!id || !image) return false;

    try {
      if (this.isDemoMode) {
        this.persistLocal(user.uid, { ...this._images(), [id]: image });
      } else {
        const data: ArtistImageOverride = {
          ownerUid: user.uid,
          artistId: id,
          image,
          updatedAt: Date.now(),
        };
        await runInInjectionContext(this.injector, () =>
          setDoc(
            doc(this.firestore, 'artist-images', this.docId(user.uid, id)),
            data,
          ),
        );
      }
      this.toastService.success(this.lang.t().photoSaved);
      return true;
    } catch {
      this.toastService.error(
        this.lang.t().toastError,
        this.lang.t().toastErrorPlural,
      );
      return false;
    }
  }

  async clearImage(artistId: string): Promise<boolean> {
    const id = this.normalizeId(artistId);
    const current = this._images();
    if (!id || !(id in current)) return false;

    try {
      if (this.isDemoMode) {
        const rest = { ...current };
        delete rest[id];
        this.persistLocal(this.currentUid(), rest);
      } else {
        const user = this.currentUser();
        if (!user) return false;
        await runInInjectionContext(this.injector, () =>
          deleteDoc(
            doc(this.firestore, 'artist-images', this.docId(user.uid, id)),
          ),
        );
      }
      this.toastService.success(this.lang.t().photoRemoved);
      return true;
    } catch {
      this.toastService.error(
        this.lang.t().toastError,
        this.lang.t().toastErrorPlural,
      );
      return false;
    }
  }

  private currentUid(): string {
    return this.ownerUid ?? '';
  }

  private currentUser(): User | null {
    return this.injector.get(AuthService).currentUser();
  }

  private persistLocal(uid: string, images: Record<string, string>): void {
    this._images.set(images);
    if (uid) {
      localStorage.setItem(`artist-images-${uid}`, JSON.stringify(images));
    }
  }

  private normalizeId(value: string): string {
    const parsed = parseCatalogId(value, 'deezer');
    return parsed ? toCatalogId(parsed.provider, parsed.externalId) : value;
  }

  private docId(uid: string, artistId: string): string {
    return `${uid}_${artistId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }
}
