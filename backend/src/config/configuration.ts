export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appName: process.env.APP_NAME || 'ERP Daytona',
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

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  sunat: {
    mode: process.env.SUNAT_MODE || 'mock',
    oseUrl: process.env.SUNAT_OSE_URL || '',
    certPath: process.env.SUNAT_CERT_PATH || '',
    certPassword: process.env.SUNAT_CERT_PASSWORD || '',
    rucEmpresa: process.env.SUNAT_RUC_EMPRESA || '',
    claveSolUsuario: process.env.SUNAT_CLAVE_SOL_USUARIO || '',
    claveSolPassword: process.env.SUNAT_CLAVE_SOL_PASSWORD || '',
    endpointBeta: process.env.SUNAT_ENDPOINT_BETA || 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    endpointProd: process.env.SUNAT_ENDPOINT_PROD || 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
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

  storage: {
    basePath: process.env.STORAGE_PATH || './storage',
    certsPath: process.env.CERTS_PATH || './storage/certs',
    pdfsPath: process.env.PDFS_PATH || './storage/pdfs',
    xmlsPath: process.env.XMLS_PATH || './storage/xmls',
  },

  bullmq: {
    sunatRetries: parseInt(process.env.SUNAT_JOB_RETRIES || '5', 10),
    sunatBackoffDelay: parseInt(process.env.SUNAT_JOB_BACKOFF_DELAY || '120000', 10),
    pdfRetries: parseInt(process.env.PDF_JOB_RETRIES || '3', 10),
  },
});
