export interface RepositoryReference {
  owner: string;
  name: string;
}

const REPOSITORY_FULL_NAME_PATTERN = /^([\w.-]+)\/([\w.-]+)$/;

/** Parses `owner/name`, trimming spaces. Returns `undefined` when the text is not a repository reference. */
export function parseRepositoryFullName(fullName: string): RepositoryReference | undefined {
  const match = REPOSITORY_FULL_NAME_PATTERN.exec(fullName.trim());
  return match ? { owner: match[1], name: match[2] } : undefined;
}

export { REPOSITORY_FULL_NAME_PATTERN };
