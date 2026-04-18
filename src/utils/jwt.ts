import jwt from 'jsonwebtoken';

export interface TokenPayload {
  id: string;
  role: 'rider' | 'driver' | 'courier';
}

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};
