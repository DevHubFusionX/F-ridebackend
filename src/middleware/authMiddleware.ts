import { type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { TokenPayload } from '../utils/jwt.js';

export const protect = async (req: any, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
        return;
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as unknown as TokenPayload;
      req.user = { id: decoded.id, role: decoded.role };

      next();
      return;
    } catch (error) {
      console.error(`[AUTH] token verification failed: ${error instanceof Error ? error.message : String(error)}`);
      res.status(401).json({ message: 'Not authorized, token failed' });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};
