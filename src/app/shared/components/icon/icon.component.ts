import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';

/** File names under `public/assets/icons`, kept in sync with the folder by the spec. */
export const ICON_NAMES = [
  'account',
  'alert',
  'check',
  'check-circle',
  'chevron-down',
  'clock',
  'close',
  'comment',
  'commit',
  'delete',
  'download',
  'external-link',
  'filter',
  'github',
  'key',
  'logout',
  'menu',
  'moon',
  'notification',
  'ok',
  'plus',
  'pr',
  'reload',
  'repository',
  'review',
  'search',
  'shield',
  'sun',
  'work',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/**
 * Decorative icon drawn from a single SVG asset used as a CSS mask, so it takes the
 * current text color in both themes. Icons never carry meaning on their own: the
 * surrounding control provides the accessible name.
 */
@Component({
  selector: 'app-icon',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-icon',
    'aria-hidden': 'true',
    '[style.--icon-url]': 'iconUrl()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(16, { transform: numberAttribute });

  protected readonly iconUrl = computed(() => `url("assets/icons/${this.name()}.svg")`);
}
