import { Router } from 'express';
import { hideEmailStatus } from '../email/email-tracker.js';
import { asyncHandler, ok, parse } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  forgotPasswordLimiter,
  loginIpLimiter,
  loginLimiter,
  registerLimiter,
  resetPasswordLimiter,
} from '../../middleware/rate-limit.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas.js';
import {
  FORGOT_PASSWORD_MESSAGE,
  authenticate,
  changePassword,
  getPublicUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from './auth.service.js';
import { clearSessionCookie, createSession, revokeSession } from './session.service.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(registerSchema, req.body);
    const userId = await registerUser(input);
    const { csrfToken } = await createSession(req, res, userId);
    return ok(res, { user: await getPublicUser(userId), csrfToken }, 'Your account has been created.', 201);
  }),
);

authRouter.post(
  '/login',
  loginIpLimiter,
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const userId = await authenticate(email, password, 'participant');
    const { csrfToken } = await createSession(req, res, userId);
    return ok(res, { user: await getPublicUser(userId), csrfToken }, 'Logged in successfully.');
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.auth) await revokeSession(req.auth.sessionId);
    clearSessionCookie(res);
    return ok(res, null, 'Logged out.');
  }),
);

/** Session bootstrap for the SPA. Returns user=null when not logged in (no 401 noise). */
authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!req.auth) return ok(res, { user: null, csrfToken: null });
    const user = await getPublicUser(req.auth.userId);
    return ok(res, { user, csrfToken: req.auth.csrfToken });
  }),
);

authRouter.post(
  '/forgot-password',
  forgotPasswordLimiter,
  asyncHandler(async (req, res) => {
    const { email } = parse(forgotPasswordSchema, req.body);
    // Same reply for every address (no account enumeration): the result is in the admin email log.
    hideEmailStatus();
    await requestPasswordReset(email, req.ip);
    return ok(res, null, FORGOT_PASSWORD_MESSAGE);
  }),
);

authRouter.post(
  '/reset-password',
  resetPasswordLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = parse(resetPasswordSchema, req.body);
    await resetPassword(token, password);
    clearSessionCookie(res);
    return ok(res, null, 'Your password has been reset. Please log in with your new password.');
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
    if (!req.auth) throw Errors.unauthorized();
    await changePassword(req.auth.userId, req.auth.sessionId, currentPassword, newPassword);
    return ok(res, null, 'Password changed. Other devices have been signed out.');
  }),
);

/** Separate admin login: only admin accounts can obtain a session here. */
export const adminAuthRouter = Router();
adminAuthRouter.post(
  '/login',
  loginIpLimiter,
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const userId = await authenticate(email, password, 'admin');
    const { csrfToken } = await createSession(req, res, userId);
    return ok(res, { user: await getPublicUser(userId), csrfToken }, 'Logged in successfully.');
  }),
);
