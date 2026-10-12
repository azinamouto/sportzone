import { StorageService } from '../services/supabase.ts';
import { BookingRequest as IBookingRequest, CreateBookingDTO, UpdateBookingDTO, BookingStatus } from '../types/booking.ts';

/**
 * Laravel-style Eloquent Model representation for BookingRequest
 */
export class BookingRequestModel {
  /**
   * Get all booking requests with optional filtering
   */
  static async all(filters?: { status?: string; sport?: string; search?: string }): Promise<IBookingRequest[]> {
    let requests = await StorageService.getAll();

    if (filters?.status && filters.status !== 'all') {
      requests = requests.filter(r => r.status === filters.status);
    }

    if (filters?.sport && filters.sport !== 'all') {
      requests = requests.filter(r => r.sport.toLowerCase() === filters.sport?.toLowerCase());
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      requests = requests.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          (r.email && r.email.toLowerCase().includes(q)) ||
          r.id.toLowerCase().includes(q) ||
          (r.message && r.message.toLowerCase().includes(q))
      );
    }

    return requests;
  }

  /**
   * Find a single booking request by ID
   */
  static async find(id: string): Promise<IBookingRequest | null> {
    return StorageService.getById(id);
  }

  /**
   * Create and persist a new customer court request
   */
  static async create(data: CreateBookingDTO): Promise<IBookingRequest> {
    return StorageService.create(data);
  }

  /**
   * Update an existing booking request
   */
  static async update(id: string, data: UpdateBookingDTO): Promise<IBookingRequest | null> {
    return StorageService.update(id, data);
  }

  /**
   * Delete a booking request
   */
  static async destroy(id: string): Promise<boolean> {
    return StorageService.delete(id);
  }

  /**
   * Aggregate statistics for the admin dashboard
   */
  static async stats() {
    const all = await StorageService.getAll();
    const total = all.length;
    const pending = all.filter(r => r.status === 'pending').length;
    const confirmed = all.filter(r => r.status === 'confirmed').length;
    const completed = all.filter(r => r.status === 'completed').length;
    const rejected = all.filter(r => r.status === 'rejected').length;

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    const todayCount = all.filter(r => r.date === todayStr).length;

    // Breakdown by sport
    const bySport: Record<string, number> = {};
    for (const r of all) {
      bySport[r.sport] = (bySport[r.sport] || 0) + 1;
    }

    return {
      total,
      pending,
      confirmed,
      completed,
      rejected,
      todayCount,
      bySport,
      isSupabaseActive: StorageService.isSupabaseConfigured(),
    };
  }
}
