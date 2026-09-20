/** HTTP failure normalized without headers or request details, so it can be stored or displayed safely. */
export class GitHubApiError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

/** GitHub refused the request because the primary or secondary rate limit was reached. */
export class GitHubRateLimitError extends GitHubApiError {
  constructor(
    status: number,
    endpoint: string,
    readonly resetAt: Date,
  ) {
    super(
      status,
      endpoint,
      `Se alcanzó el límite de peticiones de GitHub. Se restablece a las ${formatTime(resetAt)}.`,
    );
    this.name = 'GitHubRateLimitError';
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export class MissingSessionTokenError extends Error {
  constructor(readonly sessionId: string) {
    super('La sesión no tiene un token en memoria. Ingresa el token de nuevo.');
    this.name = 'MissingSessionTokenError';
  }
}

export class AccountMismatchError extends Error {
  constructor(
    readonly expectedUsername: string,
    readonly actualUsername: string,
  ) {
    super(
      `El token pertenece a @${actualUsername}, pero la cuenta está registrada como @${expectedUsername}.`,
    );
    this.name = 'AccountMismatchError';
  }
}

export class DuplicateAccountError extends Error {
  constructor(readonly username: string) {
    super(`La cuenta @${username} ya está configurada.`);
    this.name = 'DuplicateAccountError';
  }
}

export class UnknownAccountError extends Error {
  constructor(readonly accountId: string) {
    super('La cuenta no existe.');
    this.name = 'UnknownAccountError';
  }
}

export function describeGithubError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}
