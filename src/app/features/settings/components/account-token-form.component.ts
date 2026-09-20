import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';

import { describeGithubError } from '../../../core/github/github-errors';
import { GithubSessionService } from '../../../core/github/github-session.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-account-token-form',
  imports: [FormField, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-wrap items-start gap-3" novalidate (submit)="onSubmit($event)">
      <label class="block min-w-48 flex-1 text-xs font-semibold text-ink-muted">
        Token de acceso
        <span class="field field-lg mt-1.5 font-normal text-ink">
          <app-icon name="key" class="text-ink-subtle" />
          <input
            type="password"
            autocomplete="off"
            placeholder="github_pat_…"
            [formField]="tokenForm.token"
          />
        </span>
        @if (tokenForm.token().touched() && tokenForm.token().invalid()) {
          <span class="mt-1 block font-normal text-danger-ink">{{
            tokenForm.token().errors()[0]?.message
          }}</span>
        }
      </label>
      <button
        type="submit"
        class="btn btn-primary mt-[1.375rem]"
        [disabled]="tokenForm().submitting()"
      >
        @if (tokenForm().submitting()) {
          <app-icon name="reload" class="animate-spin" />
          Validando…
        } @else {
          <app-icon name="check" />
          Ingresar token
        }
      </button>
      <p class="basis-full text-xs text-ink-subtle">
        <app-icon name="shield" size="12" class="mr-1 align-[-1px]" />
        El token solo vive en memoria. Al recargar la aplicación deberás ingresarlo otra vez.
      </p>
      @if (errorMessage()) {
        <p role="alert" class="notice basis-full bg-danger-soft text-danger-ink">
          <app-icon name="alert" />
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
