import { Request, Response, NextFunction } from 'express';
import { Sessions } from '../services/sessions.ts';

const isHosted = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || (isHosted ? '' : 'admin@net');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (isHosted ? '' : 'admin123');

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticate admin with email and password
   */
  static async login(req: Request, res: Response) {
    try {
      if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return res.status(503).json({ success: false, message: 'Admin credentials are not configured.' });
      }
      const { email, password } = req.body || {};

      if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
      }

      if (email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Please check your admin email and password.',
        });
      }

      // Generate a secure session token
      const token = await Sessions.create();

      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        token,
        user: {
          email: ADMIN_EMAIL,
          role: 'administrator',
          name: 'Sports Zone Admin',
        },
      });
    } catch (error) {
      console.error('[AuthController.login] error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during login',
      });
    }
  }

  /**
   * GET /api/auth/me
   * Check if current session token is valid
   */
  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, authenticated: false });
      }

      const token = authHeader.split('Bearer ')[1].trim();
      if (!await Sessions.has(token)) {
        return res.status(401).json({ success: false, authenticated: false });
      }

      return res.status(200).json({
        success: true,
        authenticated: true,
        user: {
          email: ADMIN_EMAIL,
          role: 'administrator',
          name: 'Sports Zone Admin',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Terminate admin session
   */
  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1].trim();
        await Sessions.delete(token);
      }
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Middleware to protect admin routes
   */
  static async requireAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to access admin resources.',
        });
      }

      const token = authHeader.split('Bearer ')[1].trim();
      if (!await Sessions.has(token)) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or invalid. Please sign in again.',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
