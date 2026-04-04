"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Validation schemas
const sendMessageSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, 'Message content is required').max(1000, 'Message is too long'),
});
// Cleanup function to delete messages older than 30 days
async function cleanupOldMessages() {
    try {
        if (!client_1.default.message) {
            return;
        }
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const result = await client_1.default.message.deleteMany({
            where: {
                createdAt: {
                    lt: thirtyDaysAgo,
                },
            },
        });
        if (result.count > 0) {
            console.log(`Cleaned up ${result.count} messages older than 30 days`);
        }
    }
    catch (error) {
        console.error('Error cleaning up old messages:', error);
        // Don't throw error, just log it
    }
}
// Get all messages
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        // Check if Message model exists in Prisma client
        if (!client_1.default.message) {
            return res.status(503).json({
                success: false,
                error: 'Message model not available',
                message: 'Please run: npx prisma generate && npx prisma migrate dev',
            });
        }
        // Cleanup old messages (older than 30 days) - run in background
        cleanupOldMessages().catch((err) => {
            console.error('Background cleanup error:', err);
        });
        // Get last 100 messages, ordered by newest first, then reverse to show oldest first
        const messages = await client_1.default.message.findMany({
            where: {
                isDeleted: false,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 100, // Limit to last 100 messages
        });
        // Reverse to show oldest first (chronological order)
        messages.reverse();
        res.json({
            success: true,
            data: messages,
        });
    }
    catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch messages',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Send a message
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const { content } = sendMessageSchema.parse(req.body);
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
            });
        }
        const userId = req.user.id;
        // Check if Message model exists in Prisma client
        if (!client_1.default.message) {
            return res.status(503).json({
                success: false,
                error: 'Message model not available',
                message: 'Please run: npx prisma generate && npx prisma migrate dev',
            });
        }
        // Get user details
        const user = await client_1.default.user.findUnique({
            where: { id: userId },
            include: {
                // Avoid selecting columns that may not exist on legacy databases (e.g., category)
                role: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        // Cleanup old messages (older than 30 days) - run in background
        cleanupOldMessages().catch((err) => {
            console.error('Background cleanup error:', err);
        });
        // Create message
        // Try to create with senderEmail first, if it fails, try without it
        let message;
        try {
            // First try with senderEmail (after migration)
            message = await client_1.default.message.create({
                data: {
                    content: content.trim(),
                    senderId: userId,
                    senderName: user.username || user.email,
                    senderEmail: user.email,
                    senderRole: user.role.name,
                },
            });
        }
        catch (createError) {
            // If error is about senderEmail field not existing, try without it
            if (createError.message?.includes('senderEmail') || createError.code === 'P2009' || createError.code === 'P2012') {
                console.warn('senderEmail field not found, creating message without it. Please run: npx prisma generate && npx prisma migrate dev');
                message = await client_1.default.message.create({
                    data: {
                        content: content.trim(),
                        senderId: userId,
                        senderName: user.username || user.email,
                        senderRole: user.role.name,
                    },
                });
            }
            else {
                // Re-throw if it's a different error
                throw createError;
            }
        }
        res.json({
            success: true,
            message: 'Message sent successfully',
            data: message,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.errors,
            });
        }
        console.error('Send message error:', error);
        console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined,
        });
        res.status(500).json({
            success: false,
            error: 'Failed to send message',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: process.env.NODE_ENV === 'development' ? {
                stack: error instanceof Error ? error.stack : undefined,
            } : undefined,
        });
    }
});
// Delete a message (soft delete)
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
            });
        }
        const userId = req.user.id;
        // Check if message exists and belongs to user
        const message = await client_1.default.message.findFirst({
            where: {
                id,
                senderId: userId,
                isDeleted: false,
            },
        });
        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found',
            });
        }
        // Soft delete
        await client_1.default.message.update({
            where: { id },
            data: { isDeleted: true },
        });
        res.json({
            success: true,
            message: 'Message deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete message',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=chat.js.map