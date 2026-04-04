import jwt, { SignOptions } from 'jsonwebtoken';
import logger from './logger';
import { getEnv } from './env-validation';

// Get JWT configuration from validated environment
let finalJwtSecret: string;
let JWT_EXPIRES_IN: string;

try {
  const env = getEnv();
  finalJwtSecret = env.JWT_SECRET;
  JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
} catch {
  // Fallback for when env validation hasn't run yet
  const JWT_SECRET = process.env.JWT_SECRET;
  const DEFAULT_SECRET = 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';
  
  if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    logger.warn('⚠️  WARNING: JWT_SECRET not set. Using default for development only. This is INSECURE for production!');
  }
  
  finalJwtSecret = JWT_SECRET || DEFAULT_SECRET;
  JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
}

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  roleId: string;
  deviceId?: string;
  // Multi-tenant fields
  companyId?: string;
  isSuperAdmin?: boolean;
}

export const generateToken = (payload: TokenPayload): string => {
  const DEFAULT_SECRET = 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';
  if (!finalJwtSecret || finalJwtSecret === DEFAULT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot generate token: JWT_SECRET not configured');
    }
  }
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, finalJwtSecret, options);
};

export const verifyToken = (token: string): TokenPayload => {
  const DEFAULT_SECRET = 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';
  if (!finalJwtSecret || finalJwtSecret === DEFAULT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot verify token: JWT_SECRET not configured');
    }
  }
  return jwt.verify(token, finalJwtSecret) as TokenPayload;
};

