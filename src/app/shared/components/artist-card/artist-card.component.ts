import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { FavoriteArtist } from '../../../core/firebase/favorite-artists.service';
import { IconComponent } from '../../icons/icon.component';

@Component({
  selector: 'app-artist-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './artist-card.component.html',
  host: { class: 'flex flex-col' },
  styles: `
    /* Keep every cover rounded identically; the carousel only masks its visible width. */
    .media {
      border-radius: 18px;
      overflow: hidden;
    }
    .artist-cover-image {
      -webkit-mask-image: linear-gradient(to bottom, #000 68%, transparent 100%);
      mask-image: linear-gradient(to bottom, #000 68%, transparent 100%);
    }
    .artist-cover-shade {
      background: linear-gradient(to bottom, transparent 52%, rgb(0 0 0 / 0.92) 100%);
    }
    :host-context(.carousel-item:not(.is-large)) .artist-label,
    :host-context(.carousel-item:not(.is-large)) .artist-favorite {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .artist-label,
    .artist-favorite {
      transition:
        opacity 140ms ease,
        visibility 140ms ease;
    }
  `,
})
export class ArtistCardComponent {
  artist = input.required<FavoriteArtist>();
  isFavorite = input<boolean>(true);

  onArtistClick = output<FavoriteArtist>();
  onRemoveFavorite = output<string>();

  toggleFavorite(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.onRemoveFavorite.emit(this.artist().artistId);
  }
}
