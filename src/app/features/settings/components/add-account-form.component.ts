import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';

import { describeGithubError } from '../../../core/github/github-errors';
import { GithubSessionService } from '../../../core/github/github-session.service';

@Component({
  selector: 'app-add-account-form',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="space-y-3" novalidate (submit)="onSubmit($event)">
      <label class="block text-sm">
        <span class="font-medium">Nombre</span>
        <input
          type="text"
          autocomplete="off"
          placeholder="Trabajo"
          class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          [formField]="accountForm.name"
        />
        @if (accountForm.name().touched() && accountForm.name().invalid()) {
          <span class="mt-1 block text-red-700 dark:text-red-400">{{
            accountForm.name().errors()[0]?.message
          }}</span>
        }
      </label>

      <label class="block text-sm">
        <span class="font-medium">Token de acceso</span>
        <input
          type="password"
          autocomplete="off"
          class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          [formField]="accountForm.token"
        />
        @if (accountForm.token().touched() && accountForm.token().invalid()) {
          <span class="mt-1 block text-red-700 dark:text-red-400">{{
            accountForm.token().errors()[0]?.message
          }}</span>
        }
      </label>

      @if (errorMessage()) {
        <p role="alert" class="text-sm text-red-700 dark:text-red-400">{{ errorMessage() }}</p>
      }

      <button
        type="submit"
        class="rounded-md bg-lime-600 px-4 py-2 text-sm font-medium text-white hover:bg-lime-700 disabled:opacity-60"
        [disabled]="accountForm().submitting()"
      >
        {{ accountForm().submitting() ? 'Validando…' : 'Agregar cuenta' }}
      </button>
    </form>
  `,
})
export class AddAccountFormComponent {
  private readonly sessions = inject(GithubSessionService);

  protected readonly model = signal({ name: '', token: '' });
  protected readonly accountForm = form(this.model, (schemaPath) => {
    required(schemaPath.name, { message: 'Escribe un nombre para identificar la cuenta.' });
    required(schemaPath.token, { message: 'Pega el token de acceso.' });
  });
  protected readonly errorMessage = signal('');

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set('');

    await submit(this.accountForm, async () => {
      const { name, token } = this.model();
      try {
        await this.sessions.addAccount(name, token);
        this.model.set({ name: '', token: '' });
        this.accountForm().reset();
      } catch (error) {
        this.errorMessage.set(describeGithubError(error));
      }
    });
  }
}
