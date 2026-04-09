export interface Lender {
  id: string;
  name: string;
  city: string | null;
  organization_id: string;
}
export interface LenderBranch {
  id: string;
  lender_id: string;
  name: string;
  city: string | null;
}
export interface Vendor {
  id: string;
  name: string;
  office_city: string | null;
  office_area: string | null;
  services: string[] | null;
  organization_id: string;
}
export interface UserCreate {
  email: string;
  mobile: string;
  full_name: string;
  password: string;
  role: string;
  branch_ids?: string[];
}
