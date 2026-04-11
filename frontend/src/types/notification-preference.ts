export interface NotificationPreferenceItem {
  event_type: string;
  enabled: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferenceItem[];
}
