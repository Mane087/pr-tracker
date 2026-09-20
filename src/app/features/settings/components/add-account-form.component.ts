import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';

import { describeGithubError } from '../../../core/github/github-errors';
import { GithubSessionService } from '../../../core/github/github-session.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-add-account-form',
  imports: [FormField, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-4" novalidate (submit)="onSubmit($event)">
      <label class="block text-xs font-semibold text-ink-muted">
        Nombre
        <span class="field field-lg mt-1.5 font-normal text-ink">
          <input
            type="text"
            autocomplete="off"
            placeholder="Trabajo, Personal, Cliente…"
            [formField]="accountForm.name"
          />
        </span>
        @if (accountForm.name().touched() && accountForm.name().invalid()) {
          <span class="mt-1 block font-normal text-danger-ink">{{
            accountForm.name().errors()[0]?.message
          }}</span>
        }
      </label>

      <label class="block text-xs font-semibold text-ink-muted">
        Token de acceso
        <span class="field field-lg mt-1.5 font-normal text-ink">
          <app-icon name="key" class="text-ink-subtle" />
          <input
            type="password"
            autocomplete="off"
            placeholder="github_pat_…"
            [formField]="accountForm.token"
          />
        </span>
        @if (accountForm.token().touched() && accountForm.token().invalid()) {
          <span class="mt-1 block font-normal text-danger-ink">{{
            accountForm.token().errors()[0]?.message
          }}</span>
        }
      </label>

      <div
        class="flex flex-col gap-2.5 rounded-xl bg-primary-soft p-4 text-[13px] text-primary-ink"
      >
        <span class="inline-flex items-center gap-2 font-semibold">
          <app-icon name="github" />
          Permisos mínimos del token
        </span>
        <ul class="flex flex-col gap-1.5">
          <li class="flex items-center gap-2">
            <app-icon name="check" size="14" /> Repositorios: solo los seleccionados
          </li>
          <li class="flex items-center gap-2">
            <app-icon name="check" size="14" /> Metadata: Read
          </li>
          <li class="flex items-center gap-2">
            <app-icon name="check" size="14" /> Pull requests: Read
          </li>
        </ul>
      </div>

      @if (errorMessage()) {
        <p role="alert" class="notice bg-danger-soft text-danger-ink">
          <app-icon name="alert" />
          {{ errorMessage() }}
        </p>
      }

      <div class="flex flex-wrap items-center justify-between gap-3">
        <a
          href="https://github.com/settings/personal-access-tokens/new"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
        >
          Crear token en GitHub
          <app-icon name="external-link" size="14" />
        </a>
        <button type="submit" class="btn btn-primary" [disabled]="accountForm().submitting()">
          @if (accountForm().submitting()) {
            <app-icon name="reload" class="animate-spin" />
            Validando…
          } @else {
            <app-icon name="plus" />
            Agregar cuenta
          }
        </button>
      </div>
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
