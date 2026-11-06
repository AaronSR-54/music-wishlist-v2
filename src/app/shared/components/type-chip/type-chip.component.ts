import {
  Component,
  Input,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { TrackType } from '../../models/track.model';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="flex px-[6px] py-1 leading-none rounded-md text-ink border dark:text-bone font-display font-medium whitespace-nowrap text-xs"
      [style.borderColor]="solid ? solidBorderColor : color"
      [style.backgroundColor]="solid ? color : bgColorWithOpacity"
      [style.color]="solid ? solidTextColor : null"
      >{{ label }}</span
    >
  `,
})
export class TypeChipComponent {
  @Input({ required: true }) type: TrackType = 'track';
  @Input() solid = false;
  @Input() colorScheme: 'light' | 'dark' | null = null;

  private languageService = inject(LanguageService);

  get t() {
    return this.languageService.t();
  }

  get label() {
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
    const isDark =
      this.colorScheme === 'dark' ||
      (this.colorScheme === null &&
        document.documentElement.classList.contains('dark'));
    const colors = isDark ? COLORS_DARK : COLORS_LIGHT;
    return colors[this.type];
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
