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
  AuthCredential,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut,
  authState,
} from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { WishlistService } from '../firebase/wishlist.service';
import { FavoriteArtistsService } from '../firebase/favorite-artists.service';
import { WishlistShareService } from '../firebase/wishlist-share.service';
import { AccountDeletionService } from '../firebase/account-deletion.service';
import { DEMO_PASSWORD, DEMO_USERNAME, seedDemoData } from './demo-data';

const DEMO_FLAG_KEY = 'demo-mode';

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

  constructor() {
    // Restore a persisted demo session. The flag is applied synchronously so
    // the route guard sees it immediately; the listeners are initialized right
    // after construction, because they resolve AuthService and doing it here
    // would create a circular dependency.
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(DEMO_FLAG_KEY) === '1'
    ) {
      this.demoMode.set(true);
      queueMicrotask(() => this.initDemoSession());
    }
  }

  async loginWithGoogle(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await signInWithCredential(
        this.auth,
        await this.nativeGoogleCredential(),
      );
    } else {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
    }
    this.router.navigate(['/']);
  }

  private async nativeGoogleCredential(): Promise<AuthCredential> {
    const result = await FirebaseAuthentication.signInWithGoogle({
      skipNativeAuth: true,
    });
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error('native-auth-no-id-token');
    return GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
  }

  async logout(): Promise<void> {
    this.wishlistService.stopListener();
    await signOut(this.auth).catch(() => {});
    this.setDemoMode(false);
    this.router.navigate(['/login']);
  }

  loginWithDemo(username: string, password: string): boolean {
    const matches =
      username.trim().toLowerCase() === DEMO_USERNAME &&
      password === DEMO_PASSWORD;
    if (!matches) return false;

    this.setDemoMode(true);
    return true;
  }

  async reauthenticate(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('no-user');

    if (Capacitor.isNativePlatform()) {
      await reauthenticateWithCredential(user, await this.nativeGoogleCredential());
      return;
    }

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
    this.setDemoMode(false);
    await signOut(this.auth).catch(() => {});
    await this.router.navigate(['/login']);
  }

  setDemoMode(enabled: boolean): void {
    this.demoMode.set(enabled);
    if (typeof localStorage !== 'undefined') {
      if (enabled) localStorage.setItem(DEMO_FLAG_KEY, '1');
      else localStorage.removeItem(DEMO_FLAG_KEY);
    }
    if (enabled) this.initDemoSession();
  }

  private initDemoSession(): void {
    seedDemoData();
    this.wishlistService.initListener('demo-user', 'demo@example.com');
    this.favoriteArtistsService.initListener('demo-user');
    this.wishlistShareService.initListeners('demo-user', 'demo@example.com');
  }
}
