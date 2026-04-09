export type BroadcastStatus = "ACTIVE" | "EXPIRED" | "ACCEPTED";

export interface BroadcastInfo {
  id: string;
  broadcast_round: number;
  vendor_count: number;
  accept_deadline: string;
  status: BroadcastStatus;
}
