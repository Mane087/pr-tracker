import {
  Priority,
  ReviewStatus,
  TrackedPullRequestStatus,
  WorkStatus,
} from '../core/database/models';

export interface SelectOption<TValue extends string = TrackedPullRequestStatus> {
  value: TValue;
  label: string;
}

export const WORK_STATUS_OPTIONS: readonly SelectOption<WorkStatus>[] = [
  { value: 'CURRENT', label: 'En curso' },
  { value: 'PAUSED', label: 'Pausado' },
  { value: 'POSTPONED', label: 'Pospuesto' },
];

export const REVIEW_STATUS_OPTIONS: readonly SelectOption<ReviewStatus>[] = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'REVIEWING', label: 'Revisando' },
  { value: 'REVIEWED', label: 'Revisado' },
  { value: 'NEEDS_REVIEW', label: 'Requiere revisión' },
];

/** Ordered from highest to lowest priority. */
export const PRIORITY_OPTIONS: readonly SelectOption<Priority>[] = [
  { value: 'P3', label: 'P3 · Alta' },
  { value: 'P2', label: 'P2 · Media' },
  { value: 'P1', label: 'P1 · Baja' },
  { value: 'P0', label: 'P0 · Mínima' },
];
