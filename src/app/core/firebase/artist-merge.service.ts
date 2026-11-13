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
  doc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';

import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { LanguageService } from '../i18n/language.service';
import { parseCatalogId, toCatalogId } from '../catalog/catalog-id';

/**
 * One alias of a user-defined artist group. The group is flat: every document
 * points at the canonical (primary) artist, so chains never accumulate.
 */
export interface ArtistMerge {
  id?: string;
  ownerUid: string;
  primaryArtistId: string;
  aliasArtistId: string;
  primaryName: string;
  aliasName: string;
  addedAt: number;
}

export interface MergeMember {
  artistId: string;
  name: string;
  isPrimary: boolean;
}

/**
 * Per-user "these two Deezer profiles are the same artist" groups.
 *
 * Deezer sometimes splits an artist into several records. The user can merge
 * them from the artist page; the merge is stored in `artist-merges` (one doc
 * per alias) and every screen treats the group as one artist.
 */
@Injectable({ providedIn: 'root' })
export class ArtistMergeService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private toastService = inject(ToastService);
  private lang = inject(LanguageService);

  private _merges = signal<ArtistMerge[]>([]);
  readonly merges = this._merges.asReadonly();

  /** alias id -> primary id */
  private index = computed(() => {
    const map = new Map<string, string>();
    for (const merge of this._merges()) {
      map.set(merge.aliasArtistId, merge.primaryArtistId);
    }
    return map;
  });

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

      const col = collection(this.firestore, 'artist-merges');
      const q = query(col, where('ownerUid', '==', uid));

      this.unsubscribe = onSnapshot(q, (snap) => {
        this._merges.set(
          snap.docs.map((d) =>
            this.normalizeMerge({ id: d.id, ...d.data() } as ArtistMerge),
          ),
        );
      });
    });
  }

  private initLocalStorage(uid: string): void {
    const stored = localStorage.getItem(`artist-merges-${uid}`);
    const merges: ArtistMerge[] = stored ? JSON.parse(stored) : [];
    this._merges.set(merges.map((merge) => this.normalizeMerge(merge)));
  }

  private normalizeMerge(merge: ArtistMerge): ArtistMerge {
    return {
      ...merge,
      primaryArtistId: this.normalizeId(merge.primaryArtistId),
      aliasArtistId: this.normalizeId(merge.aliasArtistId),
    };
  }

  private normalizeId(value: string): string {
    const parsed = parseCatalogId(value, 'deezer');
    return parsed ? toCatalogId(parsed.provider, parsed.externalId) : value;
  }

  stopListener(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this._merges.set([]);
  }

  /** Follows alias -> primary links until it reaches the canonical artist. */
  resolveId(artistId: string): string {
    const map = this.index();
    let current = this.normalizeId(artistId);
    const seen = new Set<string>();

    while (map.has(current) && !seen.has(current)) {
      seen.add(current);
      current = map.get(current)!;
    }

    return current;
  }

  /** Canonical artist first, then its aliases (deduplicated). */
  groupIds(artistId: string): string[] {
    const root = this.resolveId(artistId);
    const aliases = this._merges()
      .filter((merge) => merge.primaryArtistId === root)
      .map((merge) => merge.aliasArtistId);

    return [root, ...new Set(aliases.filter((id) => id !== root))];
  }

  groupMembers(artistId: string): MergeMember[] {
    const root = this.resolveId(artistId);
    return this.groupIds(root).map((id) => ({
      artistId: id,
      name: this.nameOf(id) || id,
      isPrimary: id === root,
    }));
  }

  nameOf(artistId: string): string {
    const id = this.normalizeId(artistId);
    const asAlias = this._merges().find((merge) => merge.aliasArtistId === id);
    if (asAlias) return asAlias.aliasName;
    const asPrimary = this._merges().find((merge) => merge.primaryArtistId === id);
    return asPrimary?.primaryName ?? '';
  }

  /**
   * Merges `alias` into `primary`. If the alias was already the head of its
   * own group, its aliases move under the new primary in the same operation.
   * Returns false when both ids already resolve to the same artist.
   */
  async merge(
    primary: { artistId: string; name: string },
    alias: { artistId: string; name: string },
    user: User,
  ): Promise<boolean> {
    const root = this.resolveId(primary.artistId);
    const targetRoot = this.resolveId(alias.artistId);

    if (root === targetRoot) {
      this.toastService.error(this.lang.t().mergeSameArtist);
      return false;
    }

    const targetGroup = new Set(this.groupIds(targetRoot));
    const removedDocs = this._merges().filter(
      (merge) =>
        targetGroup.has(merge.aliasArtistId) ||
        targetGroup.has(merge.primaryArtistId),
    );
    const remaining = this._merges().filter(
      (merge) => !removedDocs.includes(merge),
    );

    const now = Date.now();
    const primaryName = this.nameOf(root) || primary.name;
    const entries: Omit<ArtistMerge, 'id'>[] = [...targetGroup].map(
      (artistId, offset) => ({
        ownerUid: user.uid,
        primaryArtistId: root,
        aliasArtistId: artistId,
        primaryName,
        aliasName:
          this.nameOf(artistId) ||
          (artistId === alias.artistId ? alias.name : artistId),
        addedAt: now + offset,
      }),
    );

    try {
      if (this.isDemoMode) {
        const updated = [
          ...remaining,
          ...entries.map((entry, offset) => ({
            id: `${now}-${offset}`,
            ...entry,
          })),
        ];
        this.persistLocal(user.uid, updated);
      } else {
        await runInInjectionContext(this.injector, async () => {
          const batch = writeBatch(this.firestore);
          for (const merge of removedDocs) {
            if (merge.id) {
              batch.delete(doc(this.firestore, 'artist-merges', merge.id));
            }
          }
          for (const entry of entries) {
            const ref = doc(collection(this.firestore, 'artist-merges'));
            batch.set(ref, entry);
          }
          await batch.commit();
        });
      }
      this.toastService.success(
        this.lang.t().mergeSuccess,
        this.lang.t().mergeSuccessPlural,
      );
      return true;
    } catch {
      this.toastService.error(
        this.lang.t().toastError,
        this.lang.t().toastErrorPlural,
      );
      return false;
    }
  }

  /** Removes one artist from its group. */
  async unmerge(aliasArtistId: string): Promise<boolean> {
    const aliasId = this.normalizeId(aliasArtistId);
    const docs = this._merges().filter(
      (merge) => merge.aliasArtistId === aliasId,
    );
    return this.removeMerges(docs, this.lang.t().unmergeSuccess);
  }

  /** Removes every alias of a canonical artist. */
  async unmergeGroup(primaryArtistId: string): Promise<boolean> {
    const root = this.resolveId(primaryArtistId);
    const docs = this._merges().filter(
      (merge) => merge.primaryArtistId === root,
    );
    return this.removeMerges(docs, this.lang.t().unmergeSuccess);
  }

  private async removeMerges(
    docs: ArtistMerge[],
    successMessage: string,
  ): Promise<boolean> {
    if (docs.length === 0) return false;

    try {
      if (this.isDemoMode) {
        const removed = new Set(docs.map((merge) => merge.aliasArtistId));
        const updated = this._merges().filter(
          (merge) => !removed.has(merge.aliasArtistId),
        );
        const uid = updated[0]?.ownerUid ?? docs[0]?.ownerUid ?? '';
        this.persistLocal(uid, updated);
      } else {
        await runInInjectionContext(this.injector, async () => {
          const batch = writeBatch(this.firestore);
          for (const merge of docs) {
            if (merge.id) {
              batch.delete(doc(this.firestore, 'artist-merges', merge.id));
            }
          }
          await batch.commit();
        });
      }
      this.toastService.success(successMessage);
      return true;
    } catch {
      this.toastService.error(
        this.lang.t().toastError,
        this.lang.t().toastErrorPlural,
      );
      return false;
    }
  }

  private persistLocal(uid: string, merges: ArtistMerge[]): void {
    this._merges.set(merges);
    if (uid) {
      localStorage.setItem(`artist-merges-${uid}`, JSON.stringify(merges));
    }
  }
}
