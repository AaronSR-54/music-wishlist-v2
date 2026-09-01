import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';

export type ButtonVariant = 'action' | 'add' | 'cover';

const BASE =
  'flex items-center justify-center cursor-pointer p-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]';

const VARIANTS: Record<ButtonVariant, string> = {
  add: `${BASE} border-none bg-bone-400 dark:bg-ink-400 rounded-card shrink-0 text-ink-600 dark:text-bone-600 w-11 h-11 hover:bg-bone-700 dark:hover:bg-ink-200 hover:text-bone-100 active:scale-[0.9]`,
  action: `${BASE} bg-transparent rounded-card border-[1.5px] border-ink-100 text-bone-600 w-8 lg:w-10 h-8 lg:h-10 hover:border-ink-400 dark:hover:border-bone-400 hover:text-bone hover:scale-105 active:scale-95`,
  cover: `${BASE} border-none bg-transparent relative shrink-0 rounded-sm disabled:cursor-not-allowed disabled:opacity-60 enabled:hover:opacity-80`,
};

@Component({
  selector: 'button[appBtn]',
  standalone: true,
  host: {
    '[class]': 'hostClass()',
  },
  template: `<ng-content />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  variant = input.required<ButtonVariant>();
  added = input(false);
  danger = input(false);

  hostClass = computed(() => {
    const v = this.variant();
    let cls = VARIANTS[v];
    if (v === 'add' && this.added()) {
      cls +=
        ' !bg-ink dark:!bg-bone !text-bone dark:!text-ink [animation:popIn_400ms_cubic-bezier(0.16,1,0.3,1)_both]';
    }
    if (v === 'action' && this.danger()) {
      cls = cls.replace(
        'hover:border-ink-400 dark:hover:border-bone-400 hover:text-bone',
        'hover:border-red-400 hover:text-red-400',
      );
    }
    return cls;
  });
}
