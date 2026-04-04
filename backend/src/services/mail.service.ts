import { Resend } from 'resend';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import prisma from '../prisma/client';
import settingsService from './settings.service';
import logger from '../utils/logger';

class MailService {
  /**
   * Get Resend Client based on system environment variables or integration settings
   */
  private async getResendClient() {
    const settings = await settingsService.getSettings();
    const apiKey = settings?.integrationConfig?.resend?.apiKey || process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error('Resend API Key is missing. Please configure it in Integrations Settings or .env');
    }

    return new Resend(apiKey);
  }

  /**
   * Send an email using Resend
   */
  async sendEmail(to: string, subject: string, html: string, text?: string) {
    try {
      const resend = await this.getResendClient();
      const settings = await settingsService.getSettings();
      
      const companyName = settings.companyName || 'System';
      // Fallback domain mapping since Resend strictly requires verified domains
      const senderEmail = settings.companyEmail || 'onboarding@resend.dev';
      
      let fromAddress = `"${companyName}" <${senderEmail}>`;

      let response = await resend.emails.send({
        from: fromAddress,
        replyTo: settings.companyEmail || undefined,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ''),
      });

      // Fallback if domain is unverified
      if (response.error && (response.error.message.toLowerCase().includes('domain') || response.error.message.toLowerCase().includes('verified'))) {
         logger.warn(`Domain for ${senderEmail} may not be verified in Resend. Falling back to onboarding@resend.dev and setting Reply-To.`);
         fromAddress = `"${companyName}" <onboarding@resend.dev>`;
         response = await resend.emails.send({
           from: fromAddress,
           replyTo: settings.companyEmail || undefined,
           to,
           subject,
           html,
           text: text || html.replace(/<[^>]*>?/gm, ''),
         });
      }

      if (response.error) {
         throw new Error(response.error.message);
      }

      logger.info(`Email sent via Resend: ${response.data?.id}`);
      
      // Persist the sent email into the application database natively
      await prisma.emailMessage.create({
         data: {
           to,
           subject,
           body: html,
           senderEmail: senderEmail,
           senderName: companyName,
           status: 'sent',
           direction: 'sent',
           isRead: true
         }
      });
      
      // IMPORTANT FIX: If the email is sent to an internal user or the company itself, 
      // immediately inject it into the shared Inbox. This bypasses the need for 
      // an external inbound webhook and circumvents Resend's free-tier sandbox limitations.
      const internalUsers = await prisma.user.findMany({ select: { email: true } });
      const internalEmails = internalUsers.map(u => u.email.toLowerCase());
      
      const isInternalRecipient = 
        internalEmails.includes(to.toLowerCase()) || 
        (settings.companyEmail && to.toLowerCase() === settings.companyEmail.toLowerCase());

      if (isInternalRecipient) {
        logger.info(`Routing internal email directly to Inbox for: ${to}`);
        await prisma.emailMessage.create({
           data: {
             to,
             subject,
             body: html,
             senderEmail: senderEmail,
             senderName: companyName,
             status: 'received',
             direction: 'received',
             isRead: false
           }
        });
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error sending email via Resend:', error);
      throw error;
    }
  }

  /**
   * Fetch Inbox messages
   */
  async fetchInbox(limit = 20) {
    try {
      const messages = await prisma.emailMessage.findMany({
        where: { direction: 'received' },
        take: limit,
        orderBy: { sentAt: 'desc' }
      });
      
      return messages.map(msg => ({
        uid: msg.id,
        seq: 0,
        subject: msg.subject,
        from: [{ name: msg.senderName || msg.senderEmail, address: msg.senderEmail }],
        to: [{ address: msg.to }],
        date: msg.sentAt.toISOString(),
        flags: msg.isRead ? ['\\Seen'] : [],
        snippet: msg.body ? msg.body.replace(/<[^>]*>?/gm, '').substring(0, 100) : '',
      }));
    } catch (error) {
      logger.error('Error fetching inbox messages from DB:', error);
      throw error;
    }
  }

  /**
   * Fetch Sent messages directly from database
   */
  async fetchSent(limit = 20) {
    try {
      const messages = await prisma.emailMessage.findMany({
        where: { direction: 'sent' },
        take: limit,
        orderBy: { sentAt: 'desc' }
      });
      
      return messages.map(msg => ({
        uid: msg.id,
        seq: 0,
        subject: msg.subject,
        from: [{ name: msg.senderName || 'System', address: msg.senderEmail }],
        to: [{ address: msg.to }],
        date: msg.sentAt.toISOString(),
        flags: ['\\Seen'],
        snippet: msg.body ? msg.body.replace(/<[^>]*>?/gm, '').substring(0, 100) : '',
      }));
    } catch (error) {
      logger.error('Error fetching sent messages from DB:', error);
      throw error;
    }
  }

  /**
   * Handle Webhook from Resend
   */
  async handleWebhook(payload: any) {
    try {
      const data = payload.data || payload.record || payload;
      
      let to = Array.isArray(data.to) ? data.to.join(', ') : (data.to || 'Unknown');
      let fromField = data.from || 'Unknown';
      let subject = data.subject || 'No Subject';
      let body = data.html || data.text || '';
      
      // Parse "Name" <email> or just email
      let senderName = null;
      let senderEmail = fromField;
      const match = fromField.match(/^(?:(?:"([^"]*)")|(?:([^<]*)))\s*<([^>]+)>$/);
      if (match) {
        senderName = (match[1] || match[2] || '').trim();
        senderEmail = match[3];
      }
      
      await prisma.emailMessage.create({
        data: {
          to,
          subject,
          body,
          senderEmail,
          senderName: senderName || null,
          status: 'received',
          direction: 'received',
          isRead: false,
          sentAt: data.created_at ? new Date(data.created_at) : new Date()
        }
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Error processing mail webhook:', error);
      throw error;
    }
  }

  /**
   * Get Unread Inbox messages count
   */
  async getUnreadCount() {
    try {
      const count = await prisma.emailMessage.count({
        where: { direction: 'received', isRead: false }
      });
      return count;
    } catch (error) {
      logger.error('Error fetching unread count from DB:', error);
      return 0;
    }
  }

  /**
   * Get Message Body from database
   */
  async getMessage(uid: string) {
    try {
      const message = await prisma.emailMessage.findUnique({
         where: { id: uid }
      });
      if (!message) {
         throw new Error('Message not found in database');
      }

      // Mark as read if it's received and unread
      if (message.direction === 'received' && !message.isRead) {
        await prisma.emailMessage.update({
          where: { id: uid },
          data: { isRead: true }
        });
      }

      return {
        uid: message.id,
        source: message.body,
      };
    } catch (error) {
      logger.error('Error fetching message body from DB:', error);
      throw error;
    }
  }

  /**
   * Sync Inbox using IMAP configuration
   */
  async syncInbox() {
    try {
      const settings = await settingsService.getSettings();
      const imapConfig = settings?.integrationConfig?.imap;

      if (!imapConfig?.enabled || !imapConfig?.host || !imapConfig?.user || !imapConfig?.password) {
        throw new Error('IMAP is not fully configured or enabled in settings.');
      }

      const client = new ImapFlow({
        host: imapConfig.host,
        port: imapConfig.port || 993,
        secure: imapConfig.tls !== false,
        auth: {
          user: imapConfig.user,
          pass: imapConfig.password
        },
        logger: false as any
      });

      await client.connect();
      logger.info('IMAP client connected successfully for sync.');
      
      let lock = await client.getMailboxLock('INBOX');
      try {
        const mailbox = client.mailbox;
        if (!mailbox || typeof mailbox === 'boolean' || typeof mailbox.exists !== 'number') {
           return { success: true, count: 0 };
        }
        
        const total = mailbox.exists;
        const messagesAdded = [];
        
        if (total > 0) {
          // Fetch the last 20 emails
          const start = Math.max(1, total - 19);
          const fetchQuery = `${start}:*`;
          
          for await (let msg of client.fetch(fetchQuery, { source: true, uid: true })) {
            if (!msg.source) continue;
            const parsed: any = await simpleParser(msg.source as Buffer);
            
            let fromField = parsed.from?.value[0]?.address || 'Unknown';
            let senderName = parsed.from?.value[0]?.name || null;
            let to = parsed.to?.value.map((val: any) => val.address).join(', ') || imapConfig.user;
            let subject = parsed.subject || 'No Subject';
            let body = parsed.html || parsed.text || '';
            let sentAt = parsed.date || new Date();
            
            // Look for existing message to prevent duplicates (using direction, subject, sender, and approximate time)
            const timeWindow = new Date(sentAt.getTime() - 24 * 60 * 60 * 1000); // 1 day window
            
            const existing = await prisma.emailMessage.findFirst({
              where: {
                direction: 'received',
                subject: subject,
                senderEmail: fromField,
                sentAt: { gte: timeWindow }
              }
            });
            
            if (!existing) {
              const newMsg = await prisma.emailMessage.create({
                data: {
                  to,
                  subject,
                  body,
                  senderEmail: fromField,
                  senderName,
                  status: 'received',
                  direction: 'received',
                  isRead: false,
                  sentAt: sentAt
                }
              });
              
              messagesAdded.push(newMsg.id);
            }
          }
        }
        
        return { success: true, count: messagesAdded.length };
      } finally {
        lock.release();
        await client.logout();
      }
    } catch (error: any) {
      logger.error('Error syncing IMAP inbox:', error);
      throw new Error(`IMAP Sync Failed: ${error.message}`);
    }
  }
}

export const mailService = new MailService();
export default mailService;
