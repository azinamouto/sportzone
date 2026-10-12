import { Request, Response, NextFunction } from 'express';
import { Sessions } from '../services/sessions.ts';
import { AdminConfigurationError, getAdminAccounts, passwordMatches, publicAdmin, sessionAccount } from '../services/adminAccounts.ts';

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticate admin with email and password
   */
  static async login(req: Request, res: Response) {
    try {
      const accounts = getAdminAccounts();
      if (!accounts.length) {
        return res.status(503).json({ success: false, message: 'Admin credentials are not configured.' });
      }
      const { email, password } = req.body || {};

      if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
      }

      const account = accounts.find(item => item.email === email.trim().toLowerCase());
      if (!account || !passwordMatches(password, account.password)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Please check your admin email and password.',
        });
      }

      // Generate a secure session token
      let token: string;
      try {
        token = await Sessions.create(account.email);
      } catch {
        // Do not log provider errors: they may include request or credential data.
        console.error('[AuthController.login] Session storage unavailable.');
        return res.status(503).json({
          success: false,
          message: 'Unable to create an admin session. Please try again later.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        token,
        user: publicAdmin(account),
      });
    } catch (error) {
      if (error instanceof AdminConfigurationError) {
        return res.status(503).json({ success: false, message: 'Admin credentials are not configured correctly.' });
      }
      console.error('[AuthController.login] Unexpected login failure.');
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
      const account = sessionAccount(token);
      if (!account) return res.status(401).json({ success: false, authenticated: false });

      return res.status(200).json({
        success: true,
        authenticated: true,
        user: publicAdmin(account),
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
      if (!await Sessions.has(token) || !sessionAccount(token)) {
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
