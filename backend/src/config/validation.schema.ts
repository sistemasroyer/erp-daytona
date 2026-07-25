import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),
  SUNAT_MODE: Joi.string().valid('mock', 'real').default('mock'),
  PERU_API_PROVIDER: Joi.string().valid('mock', 'apiinti', 'apidni').default('mock'),
  BCRYPT_ROUNDS: Joi.number().min(10).max(14).default(12),
  FRONTEND_URL: Joi.string().default('http://localhost:5173'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
});
