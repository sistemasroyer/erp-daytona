export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appName: process.env.APP_NAME || 'MARTSOFT',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  sunat: {
    mode: process.env.SUNAT_MODE || 'mock',
  },

  nubefact: {
    ruta: process.env.NUBEFACT_RUTA || '',
    token: process.env.NUBEFACT_TOKEN || '',
  },

  peruApi: {
    provider: process.env.PERU_API_PROVIDER || 'mock',
    key: process.env.PERU_API_KEY || '',
    url: process.env.PERU_API_URL || '',
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    rateLimitLogin: parseInt(process.env.RATE_LIMIT_LOGIN || '10', 10),
    rateLimitGeneral: parseInt(process.env.RATE_LIMIT_GENERAL || '100', 10),
  },

});
