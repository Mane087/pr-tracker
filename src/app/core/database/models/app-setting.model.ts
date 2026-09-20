export type AppSettingKey = 'activeAccountId' | 'lastRefreshedAt';

export interface AppSetting {
  key: AppSettingKey;
  value: string | null;
}
