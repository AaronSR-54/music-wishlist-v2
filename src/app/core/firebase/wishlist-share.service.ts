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
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
  getDocs,
} from '@angular/fire/firestore';
import { WishlistShare } from '../../shared/models/wishlist-share.model';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class WishlistShareService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  private _sharesGiven = signal<WishlistShare[]>([]);
  private _sharesReceived = signal<WishlistShare[]>([]);

  sharesGiven = this._sharesGiven.asReadonly();
  sharesReceived = this._sharesReceived.asReadonly();

  suggestedEmails = computed(() => [
    ...new Set(this._sharesGiven().map((s) => s.recipientEmail)),
  ]);

  private unsubscribe: (() => void)[] = [];
  private isDemoMode = false;

  initListeners(uid: string, email: string): void {
    if (this.unsubscribe.length > 0) return;

    runInInjectionContext(this.injector, () => {
      const auth = inject(AuthService);
      this.isDemoMode = auth.demoMode();

      if (this.isDemoMode) {
        return;
      }

      const col = collection(this.firestore, 'wishlist-shares');

      const q1 = query(
        col,
        where('ownerUid', '==', uid),
        orderBy('sharedAt', 'desc'),
      );

      const q2 = query(
        col,
        where('recipientEmail', '==', email),
        orderBy('sharedAt', 'desc'),
      );

      const unsubscribe1 = onSnapshot(q1, (snap1) => {
        const shares = snap1.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as WishlistShare,
        );
        this._sharesGiven.set(shares);
      });

      const unsubscribe2 = onSnapshot(q2, (snap2) => {
        const shares = snap2.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as WishlistShare,
        );
        this._sharesReceived.set(shares);
      });

      this.unsubscribe = [unsubscribe1, unsubscribe2];
    });
  }

  stopListeners(): void {
    this.unsubscribe.forEach((fn) => fn());
    this.unsubscribe = [];
    this._sharesGiven.set([]);
    this._sharesReceived.set([]);
  }

  async share(
    recipientEmail: string,
    ownerUid: string,
    ownerName: string,
    ownerPhotoURL: string | null,
  ): Promise<void> {
    if (this.isDemoMode) {
      const share: WishlistShare = {
        id: this.generateShareId(ownerUid, recipientEmail),
        ownerUid,
        ownerName,
        ownerPhotoURL,
        recipientEmail,
        hidden: true,
        sharedAt: Date.now(),
      };
      const current = this._sharesGiven();
      this._sharesGiven.set([share, ...current]);
      return;
    }

    const shareId = this.generateShareId(ownerUid, recipientEmail);
    const share: WishlistShare = {
      id: shareId,
      ownerUid,
      ownerName,
      ownerPhotoURL,
      recipientEmail,
      hidden: true,
      sharedAt: Date.now(),
    };

    const col = collection(this.firestore, 'wishlist');
    const q = query(col, where('addedByUid', '==', ownerUid));
    const docs = await getDocs(q);

    const batch = writeBatch(this.firestore);
    const shareDoc = doc(this.firestore, 'wishlist-shares', shareId);
    batch.set(shareDoc, share, { merge: true });

    docs.forEach((d) => {
      const data = d.data() as any;
      const sharedWith = (data['sharedWith'] as string[]) || [];
      if (!sharedWith.includes(recipientEmail)) {
        sharedWith.push(recipientEmail);
        batch.update(d.ref, { sharedWith });
      }
    });

    await batch.commit();
  }

  async unshare(shareId: string, ownerUid: string): Promise<void> {
    if (this.isDemoMode) {
      const current = this._sharesGiven();
      this._sharesGiven.set(current.filter((s) => s.id !== shareId));
      return;
    }

    const share = this._sharesGiven().find((s) => s.id === shareId);
    if (!share) return;

    const col = collection(this.firestore, 'wishlist');
    const q = query(col, where('addedByUid', '==', ownerUid));
    const docs = await getDocs(q);

    const batch = writeBatch(this.firestore);
    const shareDoc = doc(this.firestore, 'wishlist-shares', shareId);
    batch.delete(shareDoc);

    docs.forEach((d) => {
      const data = d.data() as any;
      const sharedWith = (data['sharedWith'] as string[]) || [];
      const filtered = sharedWith.filter((e) => e !== share.recipientEmail);
      if (filtered.length !== sharedWith.length) {
        batch.update(d.ref, { sharedWith: filtered });
      }
    });

    await batch.commit();
  }

  async toggleHidden(share: WishlistShare): Promise<void> {
    if (this.isDemoMode) {
      const current = this._sharesReceived();
      const updated = current.map((s) =>
        s.id === share.id ? { ...s, hidden: !s.hidden } : s,
      );
      this._sharesReceived.set(updated);
      return;
    }

    const shareDoc = doc(this.firestore, 'wishlist-shares', share.id!);
    await updateDoc(shareDoc, { hidden: !share.hidden });
  }

  async migrate(): Promise<void> {
    if (this.isDemoMode) return;

    const invitesCol = collection(this.firestore, 'wishlist-invites');
    const q = query(invitesCol, where('status', '==', 'accepted'));
    const docs = await getDocs(q);

    const batch = writeBatch(this.firestore);

    docs.forEach((d) => {
      const data = d.data() as any;
      if (data.invitedUid) {
        const shareId = this.generateShareId(
          data.wishlistOwnerId,
          data.invitedEmail,
        );
        const shareDoc = doc(this.firestore, 'wishlist-shares', shareId);
        const share: WishlistShare = {
          id: shareId,
          ownerUid: data.wishlistOwnerId,
          ownerName: data.wishlistOwnerName,
          ownerPhotoURL: null,
          recipientEmail: data.invitedEmail,
          recipientUid: data.invitedUid,
          hidden: false,
          sharedAt: data.createdAt,
        };
        batch.set(shareDoc, share, { merge: true });
      }
    });

    await batch.commit();
  }

  private generateShareId(ownerUid: string, email: string): string {
    const encodedEmail = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${ownerUid}_${encodedEmail}`;
  }
}
