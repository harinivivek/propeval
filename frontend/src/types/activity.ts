export interface ActivityLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_email: string | null;
  actor_type: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata_json: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface ActivityLogListResponse {
  logs: ActivityLogEntry[];
  total: number;
  page: number;
  page_size: number;
}
