import { Component, computed, inject, output, signal, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { WishlistService } from '../../core/firebase/wishlist.service';
import { WishlistShareService } from '../../core/firebase/wishlist-share.service';
import { WishlistEntry } from '../../shared/models/wishlist-entry.model';
import { SearchResultItemComponent } from '../../shared/components/search-result-item/search-result-item.component';
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
import { IconComponent } from '../../shared/icons/icon.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { ScrollMaskDirective } from '../../shared/directives/scroll-mask.directive';

type WishlistTab = 'pending' | 'downloaded';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SearchResultItemComponent,
    SegmentedTabsComponent,
    PageHeaderComponent,
    ContextMenuPanelComponent,
    IconComponent,
    ModalComponent,
    ScrollMaskDirective,
  ],
  styles: `
    .scroll-fade {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      scrollbar-width: none;
      padding-bottom: 2rem;
      padding-top: 4px;
    }

    .scroll-fade::-webkit-scrollbar {
      display: none;
    }

    .ready-list-scroll {
      padding: 24px 0 0;
      margin-inline: -12px;
      margin-bottom: -16px;
    }

    .ready-list-content--ready {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      margin-inline: 12px;
    }

    .ready-list-content--ready > .ready-list-card:last-child {
      margin-bottom: 32px;
    }

    .ready-list-divider {
      width: calc(100% + 1rem);
      margin-inline: -0.5rem;
    }

    .ready-list-card {
      position: relative;
      transition: box-shadow 250ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .ready-list-card--open {
      z-index: 1;
      box-shadow: 0 5px 10px rgb(0 0 0 / 0.12);
    }

    .dark .ready-list-card--open {
      box-shadow: 0 5px 10px rgb(0 0 0 / 0.32);
    }
  `,
  template: `
    @if (contextMenu()) {
      <app-context-menu-panel
        [x]="contextMenu()!.x"
        [y]="contextMenu()!.y"
        [mobile]="isMobile"
        [showRemove]="contextMenuShowRemove()"
        [removeDisabled]="contextMenuRemoveDisabled()"
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
      class="flex flex-col h-full p-0.5 pt-2 gap-4 overflow-visible [animation:fadeIn_300ms_ease_both]"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd($event)"
    >
      <app-page-header
        prefix="03/"
        [title]="t().wishlist"
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
        class="scroll-fade ready-list-scroll -mt-4 transition-opacity duration-300"
        appScrollMask
        [class.opacity-0]="animatingTab()"
      >
        <div class="ready-list-content--ready">
        @if (activeTab() === 'pending') {
            <section
              class="ready-list-card mb-2 flex flex-col p-2 rounded-lg bg-bone-200 dark:bg-ink-600 gap-1 w-full"
              [class.ready-list-card--open]="ownPendingCount() > 0 && myPendingExpanded()"
            >
              <button
                class="w-full flex items-center justify-between gap-3 px-2 py-2 text-left rounded-md bg-transparent text-ink dark:text-bone disabled:cursor-default"
                type="button"
                [disabled]="ownPendingCount() === 0"
                [attr.aria-expanded]="ownPendingCount() > 0 ? myPendingExpanded() : null"
                (click)="toggleMyPendingList()"
              >
                <span class="flex min-w-0 items-center gap-1.5">
                  <span class="font-semibold">{{ t().myReadyList }}</span>
                  <span class="font-display text-xs md:text-base text-ink-700 dark:text-bone-700 tracking-[0.06em] italic tabular-nums whitespace-nowrap">
                    · {{ ownPendingCount() }}
                    {{ ownPendingCount() === 1 ? t().element : t().elements }}
                  </span>
                </span>
                @if (ownPendingCount() > 0) {
                  <app-icon
                    [name]="myPendingExpanded() ? 'chevron-up' : 'chevron-down'"
                    class="flex h-4 w-4 shrink-0 items-center justify-center"
                  />
                }
              </button>

              @if (myPendingExpanded() || ownPendingCount() === 0) {
                <div class="ready-list-divider h-0.5 bg-bone-300 dark:bg-ink" aria-hidden="true"></div>
                <div class="px-2">
                  @for (entry of ownPendingEntries(); track entry.id; let i = $index) {
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
                        wishlistStatus="pending"
                        (onMarkDownloaded)="markDownloaded($event)"
                        (onUnmarkDownloaded)="unmarkDownloaded($event)"
                        (onMenuClick)="onItemMenuClick($event)"
                        (onArtistClick)="goToArtistPage($event)"
                      />
                    </div>
                  } @empty {
                    <div class="flex flex-col items-center gap-3 py-4">
                      <p class="px-1 text-center text-xs italic text-ink-600 dark:text-bone-600 whitespace-nowrap">
                        {{ t().noMyPendingItems }}
                      </p>
                      <button
                        class="w-full flex items-center justify-center gap-2 py-2.5 px-2 rounded-card border border-ink-200 dark:border-bone-700 bg-transparent text-ink-600 dark:text-bone-600 font-medium uppercase text-xs tracking-wide hover:bg-ink hover:text-bone dark:hover:bg-bone dark:hover:text-ink active:scale-[0.98] transition-all duration-300"
                        type="button"
                        (click)="searchRequested.emit()"
                      >
                        <app-icon name="search" class="w-3.5 h-3.5 opacity-60" />
                        {{ t().emptyPendingAction }}
                      </button>
                    </div>
                  }

                  @if (superuser.enabled() && ownPendingCount() > 0) {
                    <div class="pt-4 pb-3">
                      <button
                        class="w-full flex items-center justify-center gap-2 py-2.5 px-2 rounded-card border border-ink-200 dark:border-bone-700 bg-transparent text-ink-600 dark:text-bone-600 font-medium uppercase text-xs tracking-wide hover:bg-ink hover:text-bone dark:hover:bg-bone dark:hover:text-ink active:scale-[0.98] transition-all duration-300"
                        type="button"
                        (click)="exportWishlist(ownPendingEntries())"
                      >
                        <app-icon name="copy" class="w-3.5 h-3.5 opacity-60" />
                        {{ t().exportWishlist }}
                      </button>
                    </div>
                  }
                </div>
              }
            </section>

            @if (shareService.sharesReceivedLoaded()) {
              <section
                class="ready-list-card mb-2 flex flex-col p-2 rounded-lg bg-bone-200 dark:bg-ink-600 gap-1 w-full"
                [class.ready-list-card--open]="sharedPendingCount() > 0 && sharedPendingOpen()"
              >
                <button
                  class="w-full flex items-center justify-between gap-3 px-2 py-2 text-left rounded-md bg-transparent text-ink dark:text-bone disabled:cursor-default"
                  type="button"
                  [disabled]="sharedPendingCount() === 0"
                  [attr.aria-expanded]="sharedPendingCount() > 0 ? sharedPendingOpen() : null"
                  (click)="toggleSharedPendingLists()"
                >
                  <span class="flex min-w-0 items-center gap-1.5">
                    <span class="font-semibold">{{ t().sharedReadyLists }}</span>
                    <span class="font-display text-xs md:text-base text-ink-700 dark:text-bone-700 tracking-[0.06em] italic tabular-nums whitespace-nowrap">
                      · {{ sharedPendingCount() }}
                      {{ sharedPendingCount() === 1 ? t().element : t().elements }}
                    </span>
                  </span>
                  @if (sharedPendingCount() > 0) {
                    <app-icon
                      [name]="sharedPendingOpen() ? 'chevron-up' : 'chevron-down'"
                      class="flex h-4 w-4 shrink-0 items-center justify-center"
                    />
                  }
                </button>

                @if (sharedPendingOpen()) {
                  <div class="ready-list-divider h-0.5 bg-bone-300 dark:bg-ink" aria-hidden="true"></div>
                  <div class="px-2">
                    @if (allIncomingSharesHidden()) {
                      <div class="flex flex-col items-center gap-3 py-4">
                        <p class="px-1 text-center text-xs italic text-ink-600 dark:text-bone-600">
                          {{ t().allSharedListsHiddenMessage }}
                        </p>
                      </div>
                    } @else if (!hasIncomingShares()) {
                      <div class="flex flex-col items-center gap-3 py-4">
                        <p class="px-1 text-center text-xs italic text-ink-600 dark:text-bone-600">
                          {{ t().noSharedPeopleMessage }}
                        </p>
                      </div>
                    } @else {
                      @for (entry of sharedPendingEntries(); track entry.id; let i = $index) {
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
                            wishlistStatus="pending"
                            (onMarkDownloaded)="markDownloaded($event)"
                            (onUnmarkDownloaded)="unmarkDownloaded($event)"
                            (onMenuClick)="onItemMenuClick($event)"
                            (onArtistClick)="goToArtistPage($event)"
                          />
                        </div>
                      } @empty {
                        <div class="flex flex-col items-center gap-3 py-4">
                          <p class="px-1 text-center text-xs italic text-ink-600 dark:text-bone-600">
                            {{ t().noSharedPendingItems }}
                          </p>
                        </div>
                      }

                      @if (superuser.enabled() && sharedPendingCount() > 0) {
                        <div class="pt-4 pb-3">
                          <button
                            class="w-full flex items-center justify-center gap-2 py-2.5 px-2 rounded-card border border-ink-200 dark:border-bone-700 bg-transparent text-ink-600 dark:text-bone-600 font-medium uppercase text-xs tracking-wide hover:bg-ink hover:text-bone dark:hover:bg-bone dark:hover:text-ink active:scale-[0.98] transition-all duration-300"
                            type="button"
                            (click)="exportWishlist(sharedPendingEntries())"
                          >
                            <app-icon name="copy" class="w-3.5 h-3.5 opacity-60" />
                            {{ t().exportWishlist }}
                          </button>
                        </div>
                      }
                    }
                  </div>
                }
              </section>
            }
        } @else {
          <section
            class="ready-list-card mb-2 flex flex-col p-2 rounded-lg bg-bone-200 dark:bg-ink-600 gap-1 w-full"
            [class.ready-list-card--open]="ownDownloadedCount() > 0 && myReadyExpanded()"
          >
            <button
              class="w-full flex items-center justify-between gap-3 px-2 py-2 text-left rounded-md bg-transparent text-ink dark:text-bone disabled:cursor-default"
              type="button"
              [disabled]="ownDownloadedCount() === 0"
              [attr.aria-expanded]="ownDownloadedCount() > 0 ? myReadyExpanded() : null"
              (click)="toggleMyReadyList()"
            >
              <span class="flex min-w-0 items-center gap-1.5">
                <span class="font-semibold">{{ t().myReadyList }}</span>
                <span class="font-display text-xs md:text-base text-ink-700 dark:text-bone-700 tracking-[0.06em] italic tabular-nums whitespace-nowrap">
                  · {{ ownDownloadedCount() }}
                  {{ ownDownloadedCount() === 1 ? t().element : t().elements }}
                </span>
              </span>
              @if (ownDownloadedCount() > 0) {
                <app-icon
                  [name]="myReadyExpanded() ? 'chevron-up' : 'chevron-down'"
                  class="flex h-4 w-4 shrink-0 items-center justify-center"
                />
              }
            </button>

            @if (myReadyExpanded() || ownDownloadedCount() === 0) {
              <div class="ready-list-divider h-0.5 bg-bone-300 dark:bg-ink" aria-hidden="true"></div>
            }

            @if (myReadyExpanded() || ownDownloadedCount() === 0) {
              <div class="px-2">
                @for (entry of ownDownloadedEntries(); track entry.id; let i = $index) {
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
                      wishlistStatus="downloaded"
                      (onMarkDownloaded)="markDownloaded($event)"
                      (onUnmarkDownloaded)="unmarkDownloaded($event)"
                      (onMenuClick)="onItemMenuClick($event)"
                      (onArtistClick)="goToArtistPage($event)"
                    />
                  </div>
                } @empty {
                  <div class="flex flex-col items-center gap-3 py-4">
                    <p class="px-1 text-center text-xs italic text-ink-600 dark:text-bone-600 whitespace-nowrap">
                      {{ t().noMyReadyItems }}
                    </p>
                    <button
                      class="w-full flex items-center justify-center gap-2 py-2.5 px-2 rounded-card border border-ink-200 dark:border-bone-700 bg-transparent text-ink-600 dark:text-bone-600 font-medium uppercase text-xs tracking-wide hover:bg-ink hover:text-bone dark:hover:bg-bone dark:hover:text-ink active:scale-[0.98] transition-all duration-300"
                      type="button"
                      (click)="activeTab.set('pending')"
                    >
                      <app-icon name="chevron-left" class="w-3.5 h-3.5 opacity-60" />
                      {{ t().emptyReadyAction }}
                    </button>
                  </div>
                }

                @if (ownDownloadedCount() > 0) {
                  <div class="pt-4 pb-3">
                    <button
                      class="w-full flex items-center justify-center gap-2 py-2.5 px-2 rounded-card border border-ink-200 dark:border-bone-700 bg-transparent text-ink-600 dark:text-bone-600 font-medium uppercase text-xs tracking-wide hover:bg-red-500 hover:text-white hover:border-red-500 dark:hover:bg-red-500 dark:hover:text-white active:scale-[0.98] transition-all duration-300"
                      type="button"
                      (click)="openClearModal()"
                    >
                      <app-icon name="trash" class="w-3.5 h-3.5 opacity-60" />
                      {{ t().clearWishlist }}
                    </button>
                  </div>
                }
              </div>
            }
          </section>

          @if (shareService.sharesReceivedLoaded()) {
            <section
              class="ready-list-card mb-2 flex flex-col p-2 rounded-lg bg-bone-200 dark:bg-ink-600 gap-1 w-full"
              [class.ready-list-card--open]="sharedDownloadedCount() > 0 && sharedReadyOpen()"
            >
              <button
                class="w-full flex items-center justify-between gap-3 px-2 py-2 text-left rounded-md bg-transparent text-ink dark:text-bone disabled:cursor-default"
                type="button"
                [disabled]="sharedDownloadedCount() === 0"
                [attr.aria-expanded]="sharedDownloadedCount() > 0 ? sharedReadyOpen() : null"
                (click)="toggleSharedReadyLists()"
              >
                <span class="flex min-w-0 items-center gap-1.5">
                  <span class="font-semibold">{{ t().sharedReadyLists }}</span>
                  <span class="font-display text-xs md:text-base text-ink-700 dark:text-bone-700 tracking-[0.06em] italic tabular-nums whitespace-nowrap">
                    · {{ sharedDownloadedCount() }}
                    {{ sharedDownloadedCount() === 1 ? t().element : t().elements }}
                  </span>
                </span>
                @if (sharedDownloadedCount() > 0) {
                  <app-icon
                    [name]="sharedReadyOpen() ? 'chevron-up' : 'chevron-down'"
                    class="flex h-4 w-4 shrink-0 items-center justify-center"
                  />
                }
              </button>

              @if (sharedReadyOpen()) {
                <div class="ready-list-divider h-0.5 bg-bone-300 dark:bg-ink" aria-hidden="true"></div>
                <div class="px-2">
                  @if (allIncomingSharesHidden()) {
                    <div class="flex flex-col items-center gap-3 py-4">
                      <p class="px-1 text-center text-xs italic text-ink-600 dark:text-bone-600">
                        {{ t().allSharedListsHiddenMessage }}
                      </p>
                    </div>
                  } @else if (!hasIncomingShares()) {
                    <div class="flex flex-col items-center gap-3 py-4">
                      <p class="px-1 text-center text-xs italic text-ink-600 dark:text-bone-600">
                        {{ t().noSharedPeopleMessage }}
                      </p>
                    </div>
                  } @else {
                    @for (entry of sharedDownloadedEntries(); track entry.id; let i = $index) {
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
                          wishlistStatus="downloaded"
                          (onMarkDownloaded)="markDownloaded($event)"
                          (onUnmarkDownloaded)="unmarkDownloaded($event)"
                          (onMenuClick)="onItemMenuClick($event)"
                          (onArtistClick)="goToArtistPage($event)"
                        />
                      </div>
                    } @empty {
                      <div class="flex flex-col items-center gap-3 py-4">
                        <p class="px-1 text-center text-xs italic text-ink-600 dark:text-bone-600">
                          {{ t().noSharedReadyItems }}
                        </p>
                      </div>
                    }
                  }
                </div>
              }
            </section>
          }
        }

        </div>
      </div>

      <app-modal #clearModal [title]="t().clearWishlist" (onClose)="closeClearModal()">
        <div class="flex flex-col gap-4">
          <p class="text-sm text-ink-600 dark:text-bone-600 leading-relaxed">{{ t().confirmClearWishlist }}</p>
          <div class="flex gap-2 justify-end">
            <button
              class="px-4 py-2 rounded-full border border-ink-200 dark:border-bone-700 text-ink dark:text-bone text-sm font-bold uppercase tracking-wide hover:bg-ink hover:text-bone dark:hover:bg-bone dark:hover:text-ink transition-colors"
              (click)="closeClearModal()"
            >
              {{ t().cancel }}
            </button>
            <button
              class="px-4 py-2 rounded-full bg-red-500 text-white text-sm font-bold uppercase tracking-wide hover:bg-red-600 active:scale-95 transition-all"
              (click)="confirmClear()"
            >
              {{ t().confirm }}
            </button>
          </div>
        </div>
      </app-modal>
    </div>
  `,
})
export class WishlistComponent {
  searchRequested = output<void>();

  wishlistSvc = inject(WishlistService);
  shareService = inject(WishlistShareService);
  private languageService = inject(LanguageService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private searchSvc = inject(SearchService);
  superuser = inject(SuperuserService);

  @ViewChild('clearModal') clearModal!: ModalComponent;

  activeTab = signal<WishlistTab>(
    new URLSearchParams(window.location.search).get('wishlistTab') ===
      'downloaded'
      ? 'downloaded'
      : 'pending',
  );
  myReadyExpanded = signal(true);
  sharedReadyExpanded = signal(false);
  myPendingExpanded = signal(true);
  sharedPendingExpanded = signal(false);
  sharedPendingManuallyToggled = signal(false);
  sharedReadyManuallyToggled = signal(false);
  animatingTab = signal(false);
  contextMenu = signal<{ x: number; y: number; entry: WishlistEntry } | null>(
    null,
  );
  contextMenuShowRemove = signal(false);
  contextMenuRemoveDisabled = signal(false);
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
    return window.innerWidth < 1024;
  }

  activeEntries = computed(() =>
    this.activeTab() === 'pending'
      ? this.wishlistSvc.pending()
      : this.wishlistSvc.downloaded(),
  );

  ownDownloadedEntries = computed(() =>
    this.wishlistSvc.downloaded().filter((entry) => entry.isOwner !== false),
  );

  ownPendingEntries = computed(() =>
    this.wishlistSvc.pending().filter((entry) => entry.isOwner !== false),
  );

  sharedPendingEntries = computed(() =>
    this.wishlistSvc.pending().filter((entry) => entry.isOwner === false),
  );

  sharedDownloadedEntries = computed(() =>
    this.wishlistSvc.downloaded().filter((entry) => entry.isOwner === false),
  );

  ownPendingCount = computed(() => this.ownPendingEntries().length);

  sharedPendingCount = computed(() => this.sharedPendingEntries().length);

  sharedPendingOpen = computed(
    () =>
      this.sharedPendingCount() === 0 ||
      (this.ownPendingCount() === 0 && !this.sharedPendingManuallyToggled()) ||
      this.sharedPendingExpanded(),
  );

  ownDownloadedCount = computed(() => this.ownDownloadedEntries().length);

  sharedDownloadedCount = computed(() => this.sharedDownloadedEntries().length);

  hasIncomingShares = computed(
    () =>
      this.shareService.sharesReceived().length > 0 ||
      this.sharedPendingCount() > 0 ||
      this.sharedDownloadedCount() > 0,
  );

  allIncomingSharesHidden = computed(() => {
    const shares = this.shareService.sharesReceived();
    return shares.length > 0 && shares.every((share) => share.hidden);
  });

  sharedReadyOpen = computed(
    () =>
      this.sharedDownloadedCount() === 0 ||
      (this.ownDownloadedCount() === 0 && !this.sharedReadyManuallyToggled()) ||
      this.sharedReadyExpanded(),
  );

  toggleMyReadyList(): void {
    const expanded = !this.myReadyExpanded();
    this.myReadyExpanded.set(expanded);
    if (expanded) {
      this.sharedReadyManuallyToggled.set(true);
      this.sharedReadyExpanded.set(false);
    }
  }

  toggleMyPendingList(): void {
    const expanded = !this.myPendingExpanded();
    this.myPendingExpanded.set(expanded);
    if (expanded) {
      this.sharedPendingManuallyToggled.set(true);
      this.sharedPendingExpanded.set(false);
    }
  }

  toggleSharedPendingLists(): void {
    const expanded = !this.sharedPendingOpen();
    this.sharedPendingManuallyToggled.set(true);
    this.sharedPendingExpanded.set(expanded);
    if (expanded) this.myPendingExpanded.set(false);
  }

  toggleSharedReadyLists(): void {
    const expanded = !this.sharedReadyOpen();
    this.sharedReadyManuallyToggled.set(true);
    this.sharedReadyExpanded.set(expanded);
    if (expanded) this.myReadyExpanded.set(false);
  }

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
    const isSharedReadyItem =
      this.activeTab() === 'downloaded' && data.entry.isOwner === false;
    this.contextMenuShowRemove.set(!isSharedReadyItem);
    this.contextMenuRemoveDisabled.set(data.entry.isOwner === false);
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
    if (menu?.entry.id && menu.entry.isOwner !== false) {
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

  async exportWishlist(entries: WishlistEntry[] = this.activeEntries()): Promise<void> {
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
    if (entry.id && entry.isOwner !== false) {
      await this.wishlistSvc.remove(entry.id);
    }
  }

  openClearModal(): void {
    if (this.ownDownloadedCount() === 0) return;
    this.clearModal?.open();
  }

  closeClearModal(): void {
    this.clearModal?.close();
  }

  async confirmClear(): Promise<void> {
    if (this.ownDownloadedCount() === 0) return;
    this.closeClearModal();
    await this.wishlistSvc.clearDownloaded();
  }
}
