"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const mail_service_1 = require("../services/mail.service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
/**
 * Get Inbox messages
 */
router.get('/inbox', auth_1.authenticate, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const messages = await mail_service_1.mailService.fetchInbox(limit);
        res.json(messages);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch inbox:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch inbox' });
    }
});
/**
 * Get Sent messages
 */
router.get('/sent', auth_1.authenticate, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const messages = await mail_service_1.mailService.fetchSent(limit);
        res.json(messages);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch sent messages:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch sent messages' });
    }
});
/**
 * Webhook for incoming emails (e.g. from Resend)
 */
router.post('/webhook', async (req, res) => {
    try {
        await mail_service_1.mailService.handleWebhook(req.body);
        res.json({ success: true });
    }
    catch (error) {
        logger_1.default.error('Failed to process webhook:', error);
        res.status(500).json({ error: error.message || 'Failed to process webhook' });
    }
});
/**
 * Get unread messages count
 */
router.get('/unread-count', auth_1.authenticate, async (req, res) => {
    try {
        const count = await mail_service_1.mailService.getUnreadCount();
        res.json({ count });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch unread count:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch unread count' });
    }
});
/**
 * Trigger IMAP Sync
 */
router.post('/sync', auth_1.authenticate, async (req, res) => {
    try {
        const result = await mail_service_1.mailService.syncInbox();
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Failed to sync IMAP:', error);
        res.status(500).json({ error: error.message || 'Failed to sync inbound emails.' });
    }
});
/**
 * Send an email
 */
router.post('/send', auth_1.authenticate, async (req, res) => {
    try {
        const { to, subject, html } = req.body;
        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
        }
        await mail_service_1.mailService.sendEmail(to, subject, html);
        res.json({ success: true, message: 'Email sent successfully' });
    }
    catch (error) {
        logger_1.default.error('Failed to send email:', error);
        res.status(500).json({ error: error.message || 'Failed to send email' });
    }
});
/**
 * Get Message Detail
 */
router.get('/:uid', auth_1.authenticate, async (req, res) => {
    try {
        const { uid } = req.params;
        const message = await mail_service_1.mailService.getMessage(uid);
        res.json(message);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch message detail:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch message detail' });
    }
});
exports.default = router;
//# sourceMappingURL=mail.js.map