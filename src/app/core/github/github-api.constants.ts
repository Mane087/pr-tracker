import { HttpContextToken } from '@angular/common/http';

export const GITHUB_API_BASE_URL = 'https://api.github.com';

export const GITHUB_API_VERSION = '2022-11-28';

export const ALLOWED_AVATAR_HOST = 'avatars.githubusercontent.com';

/** Identifies which in-memory session must authenticate a GitHub request. */
export const GITHUB_SESSION_ID = new HttpContextToken<string | null>(() => null);
