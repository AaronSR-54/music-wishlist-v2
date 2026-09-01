import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { WishlistService } from '../../core/firebase/wishlist.service';
import { WishlistEntry } from '../../shared/models/wishlist-entry.model';
import { SearchResultItemComponent } from '../../shared/components/search-result-item/search-result-item.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import {
  SegmentedTabsComponent,
  SegmentedTabOption,
} from '../../shared/components/segmented-tabs/segmented-tabs.component';
import { LanguageService } from '../../core/i18n/language.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ToastService } from '../../shared/components/toast/toast.component';
import { ContextMenuPanelComponent } from '../../shared/components/context-menu-panel/context-menu-panel.component';
import { SearchService } from '../../core/api/search.service';
import { SuperuserService } from '../../core/superuser/superuser.service';

type WishlistTab = 'pending' | 'downloaded';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SearchResultItemComponent,
    EmptyStateComponent,
    SegmentedTabsComponent,
    PageHeaderComponent,
    ContextMenuPanelComponent,
  ],
  styles: `
    .scroll-fade {
      overflow-y: auto;
      scrollbar-width: none;
      padding-bottom: 2rem;
      padding-top: 4px;
      -webkit-mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 16px,
        black 95%,
        transparent 100%
      );
      mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 16px,
        black 95%,
        transparent 100%
      );
    }

    .scroll-fade::-webkit-scrollbar {
      display: none;
    }
  `,
  template: `
    @if (contextMenu()) {
      <app-context-menu-panel
        [x]="contextMenu()!.x"
        [y]="contextMenu()!.y"
        [mobile]="isMobile"
        [showRemove]="contextMenuShowRemove()"
        [showArtist]="contextMenuShowArtist()"
        [showAlbum]="contextMenuShowAlbum()"
        (onClose)="closeContextMenu()"
        (onCopyLink)="copyFromContextMenu()"
        (onGoToArtist)="goToArtistFromContextMenu()"
        (onGoToAlbum)="goToAlbumFromContextMenu()"
        (onRemove)="removeFromContextMenu()"
      />
    }

    <div
      class="flex flex-col h-full overflow-hidden p-0.5 pt-2 gap-4 [animation:fadeIn_300ms_ease_both]"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd($event)"
    >
      <app-page-header
        prefix="03/"
        title="WISHLIST"
        [showBack]="false"
        [mobileOnly]="true"
        [badge]="wishlistSvc.total() + ' ' + t().elements"
      />

      <div class="[animation:slideDown_300ms_ease_both]">
        <app-segmented-tabs
          variant="toggle"
          [options]="tabs()"
          [value]="activeTab()"
          (valueChange)="activeTab.set($event)"
        />
      </div>

      <div
        class="scroll-fade transition-opacity duration-300"
        [class.opacity-0]="animatingTab()"
      >
        @for (entry of activeEntries(); track entry.id; let i = $index) {
          <div
            class="select-none"
            [style.animation]="'dropIn 500ms cubic-bezier(0.16,1,0.3,1) both'"
            [style.animation-delay]="i * 40 + 'ms'"
            (contextmenu)="onContextMenu($event, entry)"
            (touchstart)="onItemTouchStart($event, entry)"
            (touchend)="onItemTouchEnd($event, entry)"
          >
            <app-search-result-item
              [item]="entry"
              source="wishlist"
              [wishlistStatus]="
                activeTab() === 'pending' ? 'pending' : 'downloaded'
              "
              (onMarkDownloaded)="markDownloaded($event)"
              (onUnmarkDownloaded)="unmarkDownloaded($event)"
              (onMenuClick)="onItemMenuClick($event)"
              (onArtistClick)="goToArtistPage($event)"
            />
          </div>
        } @empty {
          <app-empty-state
            [icon]="activeTab() === 'pending' ? 'plus' : 'check'"
            [title]="
              activeTab() === 'pending' ? t().wishlistTitle : t().emptyReady
            "
            [subtitle]="
              activeTab() === 'pending' ? t().searchToAdd : t().markToSee
            "
          />
        }
      </div>

      @if (superuser.enabled() && activeTab() === 'pending' && activeEntries().length > 0) {
        <div class="shrink-0 px-2 pt-2 pb-4 [animation:fadeIn_300ms_ease_both]">
          <button
            class="w-full py-3 rounded-lg bg-ink text-bone dark:bg-bone dark:text-ink font-bold uppercase text-sm tracking-wide transition-all hover:scale-[1.02] active:scale-95"
            (click)="exportWishlist()"
          >
            {{ t().exportWishlist }} ({{ activeEntries().length }})
          </button>
        </div>
      }
    </div>
  `,
})
export class WishlistComponent {
  wishlistSvc = inject(WishlistService);
  private languageService = inject(LanguageService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private searchSvc = inject(SearchService);
  superuser = inject(SuperuserService);

  activeTab = signal<WishlistTab>('pending');
  animatingTab = signal(false);
  contextMenu = signal<{ x: number; y: number; entry: WishlistEntry } | null>(
    null,
  );
  contextMenuShowRemove = signal(false);
  contextMenuShowArtist = signal(false);
  contextMenuShowAlbum = signal(false);

  t = computed(() => this.languageService.t());

  tabs = computed<SegmentedTabOption<WishlistTab>[]>(() => [
    {
      value: 'pending' as const,
      label: this.t().pending,
    },
    {
      value: 'downloaded' as const,
      label: this.t().ready,
    },
  ]);

  private touchStartX = 0;
  private touchStartY = 0;
  private longPressTimeout: ReturnType<typeof setTimeout> | null = null;
  private longPressEntry: WishlistEntry | null = null;
  private touchActive = false;

  private readonly SWIPE_THRESHOLD = 50;
  private readonly LONG_PRESS_DURATION = 500;

  get isMobile(): boolean {
    return window.innerWidth < 768;
  }

  activeEntries = computed(() =>
    this.activeTab() === 'pending'
      ? this.wishlistSvc.pending()
      : this.wishlistSvc.downloaded(),
  );

  onTouchStart(event: TouchEvent) {
    const touch = event.changedTouches[0];

    this.touchStartX = touch.screenX;
    this.touchStartY = touch.screenY;
  }

  onTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];

    const deltaX = touch.screenX - this.touchStartX;
    const deltaY = touch.screenY - this.touchStartY;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    if (Math.abs(deltaX) < this.SWIPE_THRESHOLD) {
      return;
    }

    this.animatingTab.set(true);

    setTimeout(() => {
      if (deltaX < 0) {
        this.goToNextTab();
      } else {
        this.goToPreviousTab();
      }

      this.animatingTab.set(false);
    }, 150);
  }

  onItemTouchStart(event: TouchEvent, entry: WishlistEntry) {
    this.touchActive = true;
    this.longPressEntry = entry;

    this.longPressTimeout = setTimeout(() => {
      this.copyToClipboard(entry);
      this.longPressEntry = null;
    }, this.LONG_PRESS_DURATION);
  }

  onItemTouchEnd(event: TouchEvent, _entry: WishlistEntry) {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
    this.longPressEntry = null;
    setTimeout(() => {
      this.touchActive = false;
    }, 300);
  }

  onContextMenu(event: MouseEvent, entry: WishlistEntry) {
    event.preventDefault();
    event.stopPropagation();
    if (this.touchActive) return;
    this.contextMenu.set({ x: event.clientX, y: event.clientY, entry });
    this.contextMenuShowRemove.set(false);
    this.contextMenuShowArtist.set(false);
    this.contextMenuShowAlbum.set(false);
  }

  onItemMenuClick(data: { entry: WishlistEntry; x: number; y: number }): void {
    this.contextMenu.set({ x: data.x, y: data.y, entry: data.entry });
    this.contextMenuShowRemove.set(true);
    this.contextMenuShowArtist.set(
      !!data.entry.artistId || this.isAlbumEntryType(data.entry.type),
    );
    this.contextMenuShowAlbum.set(
      !!(data.entry.albumId && data.entry.type === 'track'),
    );
  }

  private isAlbumEntryType(type: string): boolean {
    return ['album', 'ep', 'single'].includes(type);
  }

  closeContextMenu() {
    this.contextMenu.set(null);
  }

  copyFromContextMenu() {
    const menu = this.contextMenu();
    if (menu) {
      this.copyToClipboard(menu.entry);
    }
    this.closeContextMenu();
  }

  goToArtistFromContextMenu() {
    const menu = this.contextMenu();
    if (!menu) return;
    if (menu.entry.artistId) {
      this.router.navigate(['/artist', menu.entry.artistId]);
      this.closeContextMenu();
      return;
    }
    if (this.isAlbumEntryType(menu.entry.type) && menu.entry.trackId) {
      this.searchSvc.getAlbum(menu.entry.trackId).subscribe((album) => {
        if (album?.artistId) {
          this.router.navigate(['/artist', album.artistId]);
        }
        this.closeContextMenu();
      });
      return;
    }
    this.closeContextMenu();
  }

  goToAlbumFromContextMenu() {
    const menu = this.contextMenu();
    if (menu?.entry.albumId) {
      this.router.navigate(['/album', menu.entry.albumId]);
    }
    this.closeContextMenu();
  }

  removeFromContextMenu() {
    const menu = this.contextMenu();
    if (menu?.entry.id) {
      this.wishlistSvc.remove(menu.entry.id);
    }
    this.closeContextMenu();
  }

  goToArtistPage(artist: { artistId?: string; id?: string }) {
    this.router.navigate(['/artist', artist.artistId || artist.id]);
  }

  goToAlbumPage(albumId: string) {
    this.router.navigate(['/album', albumId]);
  }

  private async copyToClipboard(entry: WishlistEntry) {
    if (!entry.trackId) return;

    const url =
      entry.type === 'track'
        ? `https://deezer.com/track/${entry.trackId}`
        : `https://deezer.com/album/${entry.trackId}`;

    try {
      await navigator.clipboard.writeText(url);
      this.toast.success(this.t().toastLinkCopied);
    } catch {
      this.toast.error(this.t().toastError);
    }
  }

  async exportWishlist(): Promise<void> {
    const entries = this.activeEntries();
    if (!entries.length) return;
    const cmds = entries
      .filter((e) => e.trackId)
      .map((e) => {
        const url =
          e.type === 'track'
            ? `https://deezer.com/track/${e.trackId}`
            : `https://deezer.com/album/${e.trackId}`;
        return `godeez ${url}`;
      })
      .join('\n');
    if (!cmds) return;
    try {
      await navigator.clipboard.writeText(cmds);
      this.toast.success(this.t().wishlistExported);
    } catch {
      this.toast.error(this.t().toastError);
    }
  }

  private goToNextTab() {
    if (this.activeTab() === 'pending') {
      this.activeTab.set('downloaded');
    }
  }

  private goToPreviousTab() {
    if (this.activeTab() === 'downloaded') {
      this.activeTab.set('pending');
    }
  }

  async markDownloaded(entry: WishlistEntry) {
    if (entry.id) {
      await this.wishlistSvc.markDownloaded(entry);
    }
  }

  async unmarkDownloaded(entry: WishlistEntry) {
    if (entry.id) {
      await this.wishlistSvc.unmarkDownloaded(entry.id);
    }
  }

  async remove(entry: WishlistEntry) {
    if (entry.id) {
      await this.wishlistSvc.remove(entry.id);
    }
  }
}
