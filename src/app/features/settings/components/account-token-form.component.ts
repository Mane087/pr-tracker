import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';

import { describeGithubError } from '../../../core/github/github-errors';
import { GithubSessionService } from '../../../core/github/github-session.service';

@Component({
  selector: 'app-account-token-form',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-wrap items-end gap-2" novalidate (submit)="onSubmit($event)">
      <label class="block min-w-48 flex-1 text-sm">
        <span class="font-medium">Token de acceso</span>
        <input
          type="password"
          autocomplete="off"
          class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          [formField]="tokenForm.token"
        />
      </label>
      <button
        type="submit"
        class="rounded-md bg-lime-600 px-4 py-2 text-sm font-medium text-white hover:bg-lime-700 disabled:opacity-60"
        [disabled]="tokenForm().submitting()"
      >
        {{ tokenForm().submitting() ? 'Validando…' : 'Ingresar token' }}
      </button>
      @if (tokenForm.token().touched() && tokenForm.token().invalid()) {
        <span class="basis-full text-sm text-red-700 dark:text-red-400">{{
          tokenForm.token().errors()[0]?.message
        }}</span>
      }
      @if (errorMessage()) {
        <p role="alert" class="basis-full text-sm text-red-700 dark:text-red-400">
          {{ errorMessage() }}
        </p>
      }
    </form>
  `,
})
export class AccountTokenFormComponent {
  private readonly sessions = inject(GithubSessionService);

  readonly accountId = input.required<string>();

  protected readonly model = signal({ token: '' });
  protected readonly tokenForm = form(this.model, (schemaPath) => {
    required(schemaPath.token, { message: 'Pega el token de acceso.' });
  });
  protected readonly errorMessage = signal('');

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set('');

    await submit(this.tokenForm, async () => {
      try {
        await this.sessions.provideToken(this.accountId(), this.model().token);
        this.model.set({ token: '' });
        this.tokenForm().reset();
      } catch (error) {
        this.errorMessage.set(describeGithubError(error));
      }
    });
  }
}
