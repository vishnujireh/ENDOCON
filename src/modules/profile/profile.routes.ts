import { Router } from 'express';
import { asyncHandler, ok, parse } from '../../lib/http.js';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { profileSchema } from './profile.schemas.js';
import { getProfile, saveProfile } from './profile.service.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get(
  '/',
  asyncHandler(async (req, res) => ok(res, await getProfile(currentUserId(req)))),
);

profileRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const input = parse(profileSchema, req.body);
    const profile = await saveProfile(currentUserId(req), input);
    return ok(res, profile, 'Thank you. Your details have been saved successfully.');
  }),
);
