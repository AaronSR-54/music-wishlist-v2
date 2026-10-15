import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Query } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';

const BATCH_SIZE = 450;
const CLIENT_ID_KEY = 'mw-client-id';

@Injectable({ providedIn: 'root' })
export class AccountDeletionService {
  private firestore = inject(Firestore);
  private http = inject(HttpClient);

  async deleteAccountData(params: {
    uid: string;
    email: string;
    idToken: string;
  }): Promise<void> {
    const { uid, email, idToken } = params;

    // Release the push subscription first so no notification arrives mid-deletion.
    await this.releasePushSubscription(idToken);

    const col = (name: string) => collection(this.firestore, name);

    await this.deleteWhere(query(col('wishlist'), where('addedByUid', '==', uid)));
    await this.deleteWhere(
      query(col('favorite-artists'), where('addedByUid', '==', uid)),
    );
    await this.deleteWhere(
      query(col('wishlist-shares'), where('ownerUid', '==', uid)),
    );
    await this.deleteWhere(
      query(col('wishlist-invites'), where('wishlistOwnerId', '==', uid)),
    );

    if (email) {
      await this.deleteWhere(
        query(col('wishlist-shares'), where('recipientEmail', '==', email)),
      );
      await this.deleteWhere(
        query(col('wishlist-invites'), where('invitedEmail', '==', email)),
      );
    }
  }

  private async deleteWhere(q: Query): Promise<void> {
    const snap = await getDocs(q);
    if (snap.empty) return;

    const refs = snap.docs.map((d) => d.ref);
    for (let i = 0; i < refs.length; i += BATCH_SIZE) {
      const batch = writeBatch(this.firestore);
      refs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }

  private async releasePushSubscription(idToken: string): Promise<void> {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
    } catch {
      // A missing browser subscription must not block account deletion.
    }

    try {
      await firstValueFrom(
        this.http.post(
          '/api/push',
          { action: 'unsubscribe', clientId: this.getClientId() },
          { headers: { Authorization: `Bearer ${idToken}` } },
        ),
      );
    } catch {
      // The server record may already be gone; continue deleting local data.
    }
  }

  private getClientId(): string {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  }
}
