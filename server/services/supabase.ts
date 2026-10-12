import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BookingRequest, CreateBookingDTO, UpdateBookingDTO } from '../types/booking.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'booking_requests.json');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

let supabaseClient: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('[Sports Zone] Supabase client initialized with URL:', supabaseUrl);
  } catch (err) {
    console.warn('[Sports Zone] Failed to initialize Supabase client:', err);
  }
}

// Ensure local persistence data file exists
function ensureLocalStore(): BookingRequest[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const initialSeed: BookingRequest[] = [
        {
          id: 'SZ-2026-101',
          name: 'Mark Jason Amores',
          phone: '0917 555 8891',
          email: 'mark.amores@gmail.com',
          sport: 'Basketball',
          date: '2026-10-15',
          time: '18:00',
          duration: 2,
          message: 'Full court booking for Purok 2 inter-barangay practice. We need 1 practice ball.',
          status: 'confirmed',
          admin_notes: 'Court 1 assigned. Ball rental included.',
          court_assigned: 'Main Basketball Court',
          estimated_price: 700,
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
          updated_at: new Date(Date.now() - 3600000 * 20).toISOString(),
        },
        {
          id: 'SZ-2026-102',
          name: 'Clarisse Torcino',
          phone: '0928 441 2309',
          email: 'clarisse.t@yahoo.com',
          sport: 'Badminton',
          date: '2026-10-16',
          time: '16:00',
          duration: 1.5,
          message: 'Badminton doubles friendly match. Looking for Court A if possible.',
          status: 'pending',
          admin_notes: '',
          court_assigned: '',
          estimated_price: 360,
          created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
        {
          id: 'SZ-2026-103',
          name: 'Coach Dave Labrada',
          phone: '0939 123 9081',
          email: 'dave.labrada@gmail.com',
          sport: 'Volleyball',
          date: '2026-10-18',
          time: '15:30',
          duration: 2,
          message: 'Talibon Youth Club weekend training session with 14 players.',
          status: 'pending',
          admin_notes: '',
          court_assigned: '',
          estimated_price: 600,
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
      ];
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialSeed, null, 2), 'utf-8');
      return initialSeed;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('[Sports Zone] Error reading local store:', error);
    return [];
  }
}

function writeLocalStore(items: BookingRequest[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Sports Zone] Error writing local store:', error);
  }
}

function calculateEstimatedPrice(sport: string, duration: number): number {
  const hourlyRates: Record<string, number> = {
    Basketball: 350,
    Badminton: 240,
    Volleyball: 300,
    Pickleball: 200,
    'General Inquiry': 0,
  };
  const rate = hourlyRates[sport] ?? 250;
  return Math.round(rate * (duration || 1));
}

export const StorageService = {
  isSupabaseConfigured(): boolean {
    return !!supabaseClient;
  },

  async getAll(): Promise<BookingRequest[]> {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('booking_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as BookingRequest[];
        }
        console.warn('[Sports Zone] Supabase select failed, falling back to local store:', error?.message);
      } catch (err) {
        console.warn('[Sports Zone] Supabase error:', err);
      }
    }
    const items = ensureLocalStore();
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getById(id: string): Promise<BookingRequest | null> {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('booking_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return data as BookingRequest;
        }
      } catch (err) {
        console.warn('[Sports Zone] Supabase getById error:', err);
      }
    }
    const items = ensureLocalStore();
    return items.find(item => item.id === id) || null;
  },

  async create(dto: CreateBookingDTO): Promise<BookingRequest> {
    const durationNum = parseFloat(String(dto.duration || 1)) || 1;
    const now = new Date().toISOString();
    const id = `SZ-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const newRequest: BookingRequest = {
      id,
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      email: dto.email ? dto.email.trim() : undefined,
      sport: dto.sport,
      date: dto.date || undefined,
      time: dto.time || undefined,
      duration: durationNum,
      message: dto.message ? dto.message.trim() : undefined,
      status: 'pending',
      admin_notes: '',
      court_assigned: '',
      estimated_price: calculateEstimatedPrice(dto.sport, durationNum),
      created_at: now,
      updated_at: now,
    };

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('booking_requests')
          .insert([newRequest])
          .select()
          .single();

        if (!error && data) {
          // Also sync to local store for offline redundancy
          const local = ensureLocalStore();
          writeLocalStore([data as BookingRequest, ...local]);
          return data as BookingRequest;
        }
        console.warn('[Sports Zone] Supabase insert failed, storing locally:', error?.message);
      } catch (err) {
        console.warn('[Sports Zone] Supabase insert error:', err);
      }
    }

    const items = ensureLocalStore();
    items.unshift(newRequest);
    writeLocalStore(items);
    return newRequest;
  },

  async update(id: string, updates: UpdateBookingDTO): Promise<BookingRequest | null> {
    const now = new Date().toISOString();

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('booking_requests')
          .update({
            ...updates,
            updated_at: now,
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          const local = ensureLocalStore();
          const idx = local.findIndex(item => item.id === id);
          if (idx !== -1) {
            local[idx] = data as BookingRequest;
            writeLocalStore(local);
          }
          return data as BookingRequest;
        }
      } catch (err) {
        console.warn('[Sports Zone] Supabase update error:', err);
      }
    }

    const items = ensureLocalStore();
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1) return null;

    items[idx] = {
      ...items[idx],
      ...updates,
      updated_at: now,
    };
    writeLocalStore(items);
    return items[idx];
  },

  async delete(id: string): Promise<boolean> {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('booking_requests')
          .delete()
          .eq('id', id);

        if (!error) {
          const local = ensureLocalStore();
          writeLocalStore(local.filter(item => item.id !== id));
          return true;
        }
      } catch (err) {
        console.warn('[Sports Zone] Supabase delete error:', err);
      }
    }

    const items = ensureLocalStore();
    const filtered = items.filter(item => item.id !== id);
    if (filtered.length === items.length) return false;
    writeLocalStore(filtered);
    return true;
  },
};
