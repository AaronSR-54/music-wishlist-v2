import {
  Injectable,
  NgZone,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  authState,
} from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { WishlistService } from '../firebase/wishlist.service';
import { FavoriteArtistsService } from '../firebase/favorite-artists.service';
import { WishlistShareService } from '../firebase/wishlist-share.service';
import { AccountDeletionService } from '../firebase/account-deletion.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);
  private wishlistService = inject(WishlistService);
  private favoriteArtistsService = inject(FavoriteArtistsService);
  private wishlistShareService = inject(WishlistShareService);
  private accountDeletion = inject(AccountDeletionService);
  private ngZone = inject(NgZone);

  private firebaseUser = toSignal(authState(this.auth), { initialValue: null });
  demoMode = signal(false);

  readonly authState$ = authState(this.auth);

  private authEffect = effect(() => {
    const firebaseUser = this.firebaseUser();
    if (firebaseUser) {
      this.wishlistService.initListener(
        firebaseUser.uid,
        firebaseUser.email || '',
      );
      this.favoriteArtistsService.initListener(firebaseUser.uid);
      this.wishlistShareService.initListeners(
        firebaseUser.uid,
        firebaseUser.email || '',
      );
    } else if (!this.demoMode()) {
      this.wishlistService.stopListener();
      this.favoriteArtistsService.stopListener();
      this.wishlistShareService.stopListeners();
    }
  });

  currentUser = computed(() => {
    const firebaseUser = this.firebaseUser();
    if (firebaseUser) return firebaseUser;
    if (this.demoMode()) {
      return {
        uid: 'demo-user',
        email: 'demo@example.com',
        displayName: 'Demo User',
        photoURL: null,
        emailVerified: false,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => '',
        getIdTokenResult: async () => ({
          token: '',
          expirationTime: '',
          authTime: '',
          issuedAtTime: '',
          signInProvider: null,
          signInSecondFactor: null,
          claims: {},
        }),
        reload: async () => {},
        toJSON: () => ({}),
      } as any;
    }
    return null;
  });

  isLoggedIn = computed(() => !!this.currentUser() || this.demoMode());

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.auth, provider);
    this.router.navigate(['/']);
  }

  async logout(): Promise<void> {
    this.wishlistService.stopListener();
    await signOut(this.auth).catch(() => {});
    this.demoMode.set(false);
    this.router.navigate(['/login']);
  }

  async reauthenticate(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('no-user');

    const provider = new GoogleAuthProvider();
    await reauthenticateWithPopup(user, provider);
  }

  async deleteAccount(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || this.demoMode()) throw new Error('no-user');

    // Refresh the credential first: deleteUser() fails with
    // auth/requires-recent-login for stale sessions. If the user cancels the
    // popup this throws and nothing is deleted.
    await this.reauthenticate();

    const idToken = await user.getIdToken();
    await this.accountDeletion.deleteAccountData({
      uid: user.uid,
      email: user.email ?? '',
      idToken,
    });

    await deleteUser(user);

    this.wishlistService.stopListener();
    this.demoMode.set(false);
    await signOut(this.auth).catch(() => {});
    await this.router.navigate(['/login']);
  }

  setDemoMode(enabled: boolean): void {
    this.demoMode.set(enabled);
    if (enabled) {
      this.wishlistService.initListener('demo-user', 'demo@example.com');
      this.favoriteArtistsService.initListener('demo-user');
      this.wishlistShareService.initListeners('demo-user', 'demo@example.com');
    }
  }
}
