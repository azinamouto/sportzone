export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'completed';

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
}

export interface CreateBookingDTO {
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
  status?: BookingStatus;
  admin_notes?: string;
  court_assigned?: string;
}
