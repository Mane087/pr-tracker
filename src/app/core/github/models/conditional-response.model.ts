/**
 * Result of a conditional request. `notModified` means GitHub answered 304 to the `If-None-Match`
 * header, which does not count against the rate limit; the caller keeps its cached data.
 */
export type ConditionalResponse<T> =
  { isModified: true; data: T; etag?: string } | { isModified: false; etag?: string };

/** Unwraps a conditional response issued without an `etag`, where GitHub never answers 304. */
export function expectModified<T>(response: ConditionalResponse<T>): T {
  if (!response.isModified) {
    throw new Error('GitHub respondió sin contenido a una petición sin ETag.');
  }
  return response.data;
}
