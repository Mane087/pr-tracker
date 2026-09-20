export interface GitHubRepository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  isPrivate: boolean;
  updatedAt: Date;
}
