import { Router } from 'express';
import { BookingRequestController } from '../controllers/BookingRequestController.ts';
import { AuthController } from '../controllers/AuthController.ts';

const router = Router();

/**
 * Authentication Endpoints
 */
router.post('/auth/login', AuthController.login);
router.get('/auth/me', AuthController.me);
router.post('/auth/logout', AuthController.logout);

/**
 * Customer Endpoint: Public court reservation inquiry
 */
router.post('/requests', BookingRequestController.store);
router.get('/requests/:id/receipt', BookingRequestController.receipt);
router.patch('/requests/:id/payment-method', BookingRequestController.paymentMethod);

/**
 * Admin Dashboard Protected Endpoints
 */
router.get('/requests', AuthController.requireAdmin, BookingRequestController.index);
router.get('/requests/:id', AuthController.requireAdmin, BookingRequestController.show);
router.patch('/requests/:id', AuthController.requireAdmin, BookingRequestController.update);
router.delete('/requests/:id', AuthController.requireAdmin, BookingRequestController.destroy);
router.get('/stats', AuthController.requireAdmin, BookingRequestController.stats);

export default router;
