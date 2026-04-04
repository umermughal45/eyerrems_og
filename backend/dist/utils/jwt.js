"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = __importDefault(require("./logger"));
const env_validation_1 = require("./env-validation");
// Get JWT configuration from validated environment
let finalJwtSecret;
let JWT_EXPIRES_IN;
try {
    const env = (0, env_validation_1.getEnv)();
    finalJwtSecret = env.JWT_SECRET;
    JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
}
catch {
    // Fallback for when env validation hasn't run yet
    const JWT_SECRET = process.env.JWT_SECRET;
    const DEFAULT_SECRET = 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';
    if (!JWT_SECRET) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET environment variable is required in production');
        }
        logger_1.default.warn('⚠️  WARNING: JWT_SECRET not set. Using default for development only. This is INSECURE for production!');
    }
    finalJwtSecret = JWT_SECRET || DEFAULT_SECRET;
    JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
}
const generateToken = (payload) => {
    const DEFAULT_SECRET = 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';
    if (!finalJwtSecret || finalJwtSecret === DEFAULT_SECRET) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Cannot generate token: JWT_SECRET not configured');
        }
    }
    const options = {
        expiresIn: JWT_EXPIRES_IN,
    };
    return jsonwebtoken_1.default.sign(payload, finalJwtSecret, options);
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    const DEFAULT_SECRET = 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';
    if (!finalJwtSecret || finalJwtSecret === DEFAULT_SECRET) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Cannot verify token: JWT_SECRET not configured');
        }
    }
    return jsonwebtoken_1.default.verify(token, finalJwtSecret);
};
exports.verifyToken = verifyToken;
//# sourceMappingURL=jwt.js.map