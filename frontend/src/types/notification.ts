export interface Notification {
  id: string;
  user_id: string;
  event_type: "NEW_BROADCAST" | "REQUEST_ACCEPTED" | "REVISION_REQUESTED" | "LISTING_DOWNLOADED";
  title: string;
  message: string;
  reference_id: string;
  reference_type: "REQUEST" | "REPORT";
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  page_size: number;
}

export interface UnreadCountResponse {
  count: number;
}
