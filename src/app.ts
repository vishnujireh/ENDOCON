import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { db } from './db/knex.js';
import { logger } from './lib/logger.js';
import { loadSession } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { abstractsRouter } from './modules/abstracts/abstract.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { adminAuthRouter, authRouter } from './modules/auth/auth.routes.js';
import { emailTracker } from './modules/email/email-tracker.js';
import { invoiceRouter } from './modules/invoices/invoice.routes.js';
import { paymentsRouter, paymentWebhookRouter } from './modules/payments/payment.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { registrationRouter } from './modules/registration/registration.routes.js';
import { reviewerRouter } from './modules/review/review.routes.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
      maxAge: 600,
    }),
  );
  if (!env.isTest) {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  }

  app.get('/api/health', async (_req, res) => {
    try {
      await db.raw('SELECT 1');
      res.json({ success: true, message: 'ok', data: { db: 'up' } });
    } catch {
      res.status(503).json({ success: false, code: 'DB_DOWN', message: 'Database unavailable' });
    }
  });

  // Webhook needs the raw body for signature verification: mount before JSON parsing and CSRF.
  app.use('/api/payments/webhook', paymentWebhookRouter);

  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  // emailTracker: emails queued by a request are sent right away and reported in its reply.
  app.use('/api', apiLimiter, loadSession, csrfProtection, emailTracker);

  app.use('/api/auth', authRouter);
  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/registration', registrationRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/invoices', invoiceRouter);
  app.use('/api/abstracts', abstractsRouter);
  app.use('/api/admin', adminRouter);
  // Abstract reviewers (judges): own OTP login + session; never user or admin APIs.
  app.use('/api/reviewer', reviewerRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
