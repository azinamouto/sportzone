export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'completed';
export type PaymentMethod = 'cash' | 'card' | 'gcash' | 'other';

export interface BookingRequest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  sport: string;
  date?: string;
  time?: string;
  duration: number;
  message?: string;
  status: BookingStatus;
  admin_notes?: string;
  court_assigned?: string;
  estimated_price?: number;
  created_at: string;
  updated_at: string;
  tracking_token_hash?: string;
  payment_method?: PaymentMethod | null;
}

export interface CreateBookingDTO {
  tracking_token_hash?: string;
  name: string;
  phone: string;
  email?: string;
  sport: string;
  date?: string;
  time?: string;
  duration?: number | string;
  message?: string;
}

export interface UpdateBookingDTO {
  payment_method?: PaymentMethod;
  status?: BookingStatus;
  admin_notes?: string;
  court_assigned?: string;
}
