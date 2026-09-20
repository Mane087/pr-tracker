import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ICON_NAMES, IconComponent } from './icon.component';

const ICONS_FOLDER = resolve(__dirname, '../../../../../public/assets/icons');

@Component({
  imports: [IconComponent],
  template: '<app-icon name="reload" size="20" />',
})
class HostComponent {}

describe('IconComponent', () => {
  it('masks the host element with the named asset and hides it from assistive technology', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();

    const icon = (fixture.nativeElement as HTMLElement).querySelector('app-icon') as HTMLElement;

    expect(icon.classList.contains('app-icon')).toBe(true);
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.style.getPropertyValue('--icon-url')).toBe('url("assets/icons/reload.svg")');
    expect(icon.style.width).toBe('20px');
    expect(icon.style.height).toBe('20px');
  });

  it('declares exactly the SVG files that exist under public/assets/icons', () => {
    const files = readdirSync(ICONS_FOLDER)
      .filter((file) => file.endsWith('.svg'))
      .map((file) => file.replace(/\.svg$/, ''))
      .sort();

    expect([...ICON_NAMES].sort()).toEqual(files);
  });
});
