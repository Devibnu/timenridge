import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  role: string;
}

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

/**
 * Signs a JWT for a given user payload.
 */
export function signToken(payload: TokenPayload, expiresIn = JWT_EXPIRES_IN): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

/**
 * Verifies a JWT and returns the payload.
 * Throws an error if invalid.
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
