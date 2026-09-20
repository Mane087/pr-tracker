import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { describeGithubError } from '../../core/github/github-errors';
import { GithubSessionService } from '../../core/github/github-session.service';
import { GitHubAccountSession } from '../../core/github/models';
import { AccountTokenFormComponent } from './components/account-token-form.component';
import { AddAccountFormComponent } from './components/add-account-form.component';

@Component({
  selector: 'app-settings',
  imports: [AccountTokenFormComponent, AddAccountFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  protected readonly sessions = inject(GithubSessionService);
  protected readonly errorMessage = signal('');

  protected async forgetAccount(account: GitHubAccountSession): Promise<void> {
    const isConfirmed = globalThis.confirm(
      `¿Olvidar la cuenta "${account.name}"? Se eliminarán también sus Pull Requests seguidos.`,
    );
    if (!isConfirmed) {
      return;
    }

    this.errorMessage.set('');
    try {
      await this.sessions.forgetAccount(account.id);
    } catch (error) {
      this.errorMessage.set(describeGithubError(error));
    }
  }
}
