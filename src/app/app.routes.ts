import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'work',
    title: 'Trabajo · PR Tracker',
    loadComponent: () =>
      import('./features/work/work.component').then((module) => module.WorkComponent),
  },
  {
    path: 'review',
    title: 'Revisión · PR Tracker',
    loadComponent: () =>
      import('./features/review/review.component').then((module) => module.ReviewComponent),
  },
  {
    path: 'settings',
    title: 'Cuentas · PR Tracker',
    loadComponent: () =>
      import('./features/settings/settings.component').then((module) => module.SettingsComponent),
  },
  { path: '', redirectTo: 'work', pathMatch: 'full' },
  { path: '**', redirectTo: 'work' },
];
