import { Router } from 'express';
import { asyncHandler, idParam } from '../../lib/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { getInvoicePdf } from './invoice.service.js';

export const invoiceRouter = Router();
invoiceRouter.use(requireAuth);

/** Owner or admin only. */
invoiceRouter.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const { buffer, filename } = await getInvoicePdf(idParam(req), (ownerId) => auth.role === 'admin' || auth.userId === ownerId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }),
);
