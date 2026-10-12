import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// In-memory token store for admin sessions
const activeSessions = new Set<string>();

const ADMIN_EMAIL = 'admin@net';
const ADMIN_PASSWORD = 'admin123';

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticate admin with email and password
   */
  static login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
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
      const token = `sz_admin_${crypto.randomBytes(24).toString('hex')}`;
      activeSessions.add(token);

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
  static me(req: Request, res: Response) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, authenticated: false });
    }

    const token = authHeader.split('Bearer ')[1].trim();
    if (!activeSessions.has(token)) {
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
  }

  /**
   * POST /api/auth/logout
   * Terminate admin session
   */
  static logout(req: Request, res: Response) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1].trim();
      activeSessions.delete(token);
    }
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  /**
   * Middleware to protect admin routes
   */
  static requireAdmin(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access admin resources.',
      });
    }

    const token = authHeader.split('Bearer ')[1].trim();
    if (!activeSessions.has(token)) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid. Please sign in again.',
      });
    }

    next();
  }
}
