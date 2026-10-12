import { Request, Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { BookingRequestModel } from '../models/BookingRequest.ts';
import { CreateBookingDTO, UpdateBookingDTO, BookingStatus } from '../types/booking.ts';

/**
 * Controller handling customer court inquiries & Admin operations
 * Formatted cleanly according to Laravel Resource Controller conventions
 */
export class BookingRequestController {
  /**
   * GET /api/requests
   * Display a listing of booking requests
   */
  static async index(req: Request, res: Response) {
    try {
      const { status, sport, search } = req.query;
      const requests = await BookingRequestModel.all({
        status: typeof status === 'string' ? status : undefined,
        sport: typeof sport === 'string' ? sport : undefined,
        search: typeof search === 'string' ? search : undefined,
      });

      return res.status(200).json({
        success: true,
        data: requests,
        count: requests.length,
      });
    } catch (error: any) {
      console.error('[BookingRequestController.index] error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve booking requests',
        error: error?.message || 'Server error',
      });
    }
  }

  /**
   * POST /api/requests
   * Store a newly created booking request from customer
   */
  static async store(req: Request, res: Response) {
    try {
      const { name, phone, email, sport, date, time, duration, message } = req.body;

      // Basic validation matching Laravel FormRequest
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(422).json({
          success: false,
          errors: { name: ['The customer name is required.'] },
        });
      }

      if (!phone || typeof phone !== 'string' || !phone.trim()) {
        return res.status(422).json({
          success: false,
          errors: { phone: ['A valid mobile contact number is required.'] },
        });
      }

      if (!sport || typeof sport !== 'string') {
        return res.status(422).json({
          success: false,
          errors: { sport: ['Please select a sport or facility.'] },
        });
      }

      const dto: CreateBookingDTO = {
        name,
        phone,
        email,
        sport,
        date,
        time,
        duration: duration || 1,
        message,
      };

      const trackingToken = randomBytes(32).toString('hex');
      dto.tracking_token_hash = createHash('sha256').update(trackingToken).digest('hex');
      const created = await BookingRequestModel.create(dto);
      const { tracking_token_hash, ...customerRequest } = created;

      return res.status(201).json({
        success: true,
        message: 'Court booking request submitted successfully! Our team will review your slot.',
        data: customerRequest,
        tracking_token: trackingToken,
      });
    } catch (error: any) {
      console.error('[BookingRequestController.store] error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save booking request',
        error: error?.message || 'Server error',
      });
    }
  }

  /** Customer receipt: the reference alone never grants access to a booking. */
  static async receipt(req: Request, res: Response) {
    const token = req.get('X-Receipt-Token') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(404).json({ success: false, message: 'Receipt not found.' });
    }
    try {
      const request = await BookingRequestModel.find(req.params.id);
      const hash = createHash('sha256').update(token).digest();
      const stored = Buffer.from(request?.tracking_token_hash || '', 'hex');
      if (!request || stored.length !== hash.length || !timingSafeEqual(stored, hash)) {
        return res.status(404).json({ success: false, message: 'Receipt not found.' });
      }
      const { id, sport, date, time, duration, status, court_assigned, created_at, updated_at } = request;
      return res.json({ success: true, data: {
        id, sport, date, time, duration, status, court_assigned, created_at, updated_at,
      } });
    } catch {
      return res.status(503).json({ success: false, message: 'Status unavailable. Please try again.' });
    }
  }

  /**
   * GET /api/requests/:id
   * Display the specified booking request
   */
  static async show(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const request = await BookingRequestModel.find(id);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: `Booking request with ID ${id} not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: request,
      });
    } catch (error: any) {
      console.error('[BookingRequestController.show] error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching booking request',
      });
    }
  }

  /**
   * PATCH /api/requests/:id
   * Update booking status, assigned court, or admin notes
   */
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, admin_notes, court_assigned } = req.body;

      const validStatuses: BookingStatus[] = ['pending', 'confirmed', 'rejected', 'completed'];
      if (status && !validStatuses.includes(status)) {
        return res.status(422).json({
          success: false,
          errors: { status: [`Status must be one of: ${validStatuses.join(', ')}`] },
        });
      }

      const updates: UpdateBookingDTO = {};
      if (status) updates.status = status;
      if (admin_notes !== undefined) updates.admin_notes = admin_notes;
      if (court_assigned !== undefined) updates.court_assigned = court_assigned;

      const updated = await BookingRequestModel.update(id, updates);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: `Booking request with ID ${id} not found`,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Booking request marked as ${updated.status}`,
        data: updated,
      });
    } catch (error: any) {
      console.error('[BookingRequestController.update] error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update booking request',
      });
    }
  }

  /**
   * DELETE /api/requests/:id
   * Remove the specified booking request
   */
  static async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = await BookingRequestModel.destroy(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: `Booking request with ID ${id} not found`,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Booking request deleted successfully',
      });
    } catch (error: any) {
      console.error('[BookingRequestController.destroy] error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete booking request',
      });
    }
  }

  /**
   * GET /api/stats
   * Dashboard key performance indicators & metrics
   */
  static async stats(req: Request, res: Response) {
    try {
      const stats = await BookingRequestModel.stats();
      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('[BookingRequestController.stats] error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve stats',
      });
    }
  }
}
