export type User = {
  id: number;
  email: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  firm_name?: string | null;
  location_latitude: number;
  location_longitude: number;
  address_string?: string | null;
  role_id: number;
  is_active: boolean;
  email_verified: boolean;
  last_login?: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UserRequest = {
  email: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  firm_name?: string;
  password: string;
  location_latitude: number;
  location_longitude: number;
  address_string?: string;
  role_id: number;
};

export type UserResponse = {
  id: number;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  firm_name?: string | null;
  location_latitude?: number;
  location_longitude?: number;
  address_string?: string | null;
  role_id?: number;
  is_active?: boolean;
  last_login?: Date | null;
  created_at?: Date;
  updated_at?: Date;
};

export type Session = {
  id: string;
  user_id: number;
    token: string;
    expires_at: Date;
    user_agent: string | null;
    ip_address: string | null;
    created_at: Date;
};

export type UpdateUserData = {
  email?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  role_id?: number;
  location_latitude?: number;
    location_longitude?: number;
    address_string?: string;
  is_active?: boolean;
  email_verified?: boolean;
  password?: string;
};