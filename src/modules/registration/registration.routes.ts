import { Router } from 'express';
import { db } from '../../db/knex.js';
import { asyncHandler, ok, parse } from '../../lib/http.js';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { cartSchema, priceCart, toQuoteDto } from './cart.service.js';
import { getRegistrationStatus } from './registration.service.js';

export const registrationRouter = Router();
registrationRouter.use(requireAuth);

registrationRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    return ok(res, await getRegistrationStatus(currentUserId(req)));
  }),
);

/** Server-priced summary for the proposed purchase. No side effects. */
registrationRouter.post(
  '/quote',
  asyncHandler(async (req, res) => {
    const cart = parse(cartSchema, req.body);
    const priced = await priceCart(db, currentUserId(req), cart);
    return ok(res, toQuoteDto(priced));
  }),
);
