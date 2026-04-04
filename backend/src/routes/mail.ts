import express, { Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { mailService } from '../services/mail.service';
import logger from '../utils/logger';

const router = (express as any).Router();

/**
 * Get Inbox messages
 */
router.get('/inbox', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const messages = await mailService.fetchInbox(limit);
    res.json(messages);
  } catch (error: any) {
    logger.error('Failed to fetch inbox:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch inbox' });
  }
});

/**
 * Get Sent messages
 */
router.get('/sent', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const messages = await mailService.fetchSent(limit);
    res.json(messages);
  } catch (error: any) {
    logger.error('Failed to fetch sent messages:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sent messages' });
  }
});

/**
 * Webhook for incoming emails (e.g. from Resend)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    await mailService.handleWebhook(req.body);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to process webhook:', error);
    res.status(500).json({ error: error.message || 'Failed to process webhook' });
  }
});

/**
 * Get unread messages count
 */
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const count = await mailService.getUnreadCount();
    res.json({ count });
  } catch (error: any) {
    logger.error('Failed to fetch unread count:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch unread count' });
  }
});

/**
 * Trigger IMAP Sync
 */
router.post('/sync', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await mailService.syncInbox();
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to sync IMAP:', error);
    res.status(500).json({ error: error.message || 'Failed to sync inbound emails.' });
  }
});

/**
 * Send an email
 */
router.post('/send', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to, subject, html } = req.body;
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }
    await mailService.sendEmail(to, subject, html);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    logger.error('Failed to send email:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

/**
 * Get Message Detail
 */
router.get('/:uid', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { uid } = req.params;
    const message = await mailService.getMessage(uid);
    res.json(message);
  } catch (error: any) {
    logger.error('Failed to fetch message detail:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch message detail' });
  }
});

export default router;
