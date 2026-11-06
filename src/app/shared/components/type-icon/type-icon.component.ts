import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { TrackType } from '../../models/track.model';
import { IconComponent } from '../../icons/icon.component';
import { IconName } from '../../icons/icon-registry';
import { LanguageService } from '../../../core/i18n/language.service';
// @ts-ignore
import tailwindConfig from '../../../../../tailwind.config';

const createColorMap = (palette: Record<string, string>) => ({
  track: palette['track'],
  album: palette['album'],
  ep: palette['ep'],
  single: palette['track'],
  artist: palette['artist'],
});

const COLORS_DARK = createColorMap(tailwindConfig.accentDark);

const TYPE_ICONS: Record<TrackType, IconName> = {
  track: 'music-note-single',
  single: 'music-note-single',
  album: 'album',
  ep: 'ep',
  artist: 'person',
};

@Component({
  selector: 'app-type-icon',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'cover') {
      <span
        class="flex h-5 w-5 items-center justify-center rounded-md border shadow-sm"
        role="img"
        [attr.aria-label]="label"
        [style.backgroundColor]="color"
        [style.borderColor]="solidBorderColor"
      >
        <app-icon
          [name]="icon"
          class="h-3 w-3"
          [style.color]="solidTextColor"
        />
      </span>
    } @else {
      <span class="inline-flex shrink-0" aria-hidden="true">
        <app-icon
          [name]="icon"
          [class]="iconSize() === 'small' ? 'h-3 w-3' : 'h-3.5 w-3.5'"
        />
      </span>
    }
  `,
})
export class TypeIconComponent {
  type = input.required<TrackType>();
  variant = input<'filter' | 'cover'>('filter');
  iconSize = input<'normal' | 'small'>('normal');

  private languageService = inject(LanguageService);

  get icon(): IconName {
    return TYPE_ICONS[this.type()];
  }

  get label(): string {
    const translations = this.languageService.t();
    const labels: Partial<Record<TrackType, string>> = {
      track: translations.track,
      single: 'Single',
      album: translations.album,
      ep: 'EP',
      artist: translations.artist,
    };
    return labels[this.type()] ?? '';
  }

  get color(): string {
    return COLORS_DARK[this.type()];
  }

  get solidTextColor(): string {
    const hex = this.color.slice(1);
    const channelLuminance = (offset: number) => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance =
      0.2126 * channelLuminance(0) +
      0.7152 * channelLuminance(2) +
      0.0722 * channelLuminance(4);
    return luminance > 0.179 ? '#171513' : '#ffffff';
  }

  get solidBorderColor(): string {
    const hex = this.solidTextColor.slice(1);
    const channel = (offset: number) =>
      parseInt(hex.slice(offset, offset + 2), 16);
    return `rgba(${channel(0)}, ${channel(2)}, ${channel(4)}, 0.24)`;
  }
}
