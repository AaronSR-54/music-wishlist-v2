import {
  Component,
  Input,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { TrackType } from '../../models/track.model';
import { LanguageService } from '../../../core/i18n/language.service';
import { TypeIconComponent } from '../type-icon/type-icon.component';
// @ts-ignore
import tailwindConfig from '../../../../../tailwind.config';

const createColorMap = (palette: Record<string, string>) => ({
  track: palette['track'],
  album: palette['album'],
  ep: palette['ep'],
  single: palette['track'],
  artist: palette['artist'],
});

const COLORS_LIGHT = createColorMap(tailwindConfig.accentLight);
const COLORS_DARK = createColorMap(tailwindConfig.accentDark);

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

@Component({
  selector: 'app-type-chip',
  standalone: true,
  imports: [TypeIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.display]': "size === 'filter' ? 'block' : null",
    '[style.width]': "size === 'filter' ? '100%' : null",
  },
  template: `
    <span
      class="flex items-center leading-none rounded-md text-ink border dark:text-bone font-display font-medium whitespace-nowrap text-xs"
      [class.w-full]="size === 'filter'"
      [class.justify-center]="size === 'filter'"
       [style.padding]="size === 'filter' ? '6px 4px' : '4px 6px'"
       [style.fontSize]="size === 'filter' ? '0.75rem' : size === 'cover' ? '0.625rem' : null"
       [style.borderColor]="
         size === 'filter'
           ? solid ? color : filterBorderColor
           : solid ? solidBorderColor : color
       "
       [style.backgroundColor]="
         size === 'filter'
           ? solid ? bgColorWithOpacity : 'transparent'
           : solid ? color : bgColorWithOpacity
       "
       [style.color]="
         size === 'filter' && solid ? '#171513' : solid ? solidTextColor : null
       "
      >
      @if (size === 'filter' || size === 'cover') {
        <span
          class="inline-flex items-center justify-center"
          [style.gap.px]="size === 'cover' ? 4 : 6"
        >
          <app-type-icon
            [type]="type"
            variant="filter"
            [iconSize]="size === 'cover' ? 'small' : 'normal'"
          />
          {{ label }}
        </span>
      } @else {
        {{ label }}
      }
    </span>
  `,
})
export class TypeChipComponent {
  @Input({ required: true }) type: TrackType = 'track';
  @Input() solid = false;
  @Input() size: 'default' | 'filter' | 'cover' = 'default';
  @Input() colorScheme: 'light' | 'dark' | null = null;
  @Input() labelOverride: string | null = null;

  private languageService = inject(LanguageService);

  get t() {
    return this.languageService.t();
  }

  get label() {
    if (this.labelOverride !== null) return this.labelOverride;

    const translations = this.t;
    const labels: Partial<Record<TrackType, string>> = {
      track: translations.track,
      album: translations.album,
      ep: 'EP',
      single: 'Single',
      artist: translations.artist,
    };
    return labels[this.type];
  }

  get color() {
    const colors = this.isDarkTheme ? COLORS_DARK : COLORS_LIGHT;
    return colors[this.type];
  }

  get filterBorderColor() {
    return this.isDarkTheme ? '#cdc5b7' : '#22201f';
  }

  private get isDarkTheme() {
    return (
      this.colorScheme === 'dark' ||
      (this.colorScheme === null &&
        document.documentElement.classList.contains('dark'))
    );
  }

  get bgColorWithOpacity() {
    return hexToRgba(this.color, 0.1);
  }

  get solidTextColor() {
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

  get solidBorderColor() {
    return hexToRgba(this.solidTextColor, 0.24);
  }
}
