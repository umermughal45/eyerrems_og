declare class MailService {
    /**
     * Get Resend Client based on system environment variables or integration settings
     */
    private getResendClient;
    /**
     * Send an email using Resend
     */
    sendEmail(to: string, subject: string, html: string, text?: string): Promise<import("resend").CreateEmailResponseSuccess>;
    /**
     * Fetch Inbox messages
     */
    fetchInbox(limit?: number): Promise<{
        uid: string;
        seq: number;
        subject: string;
        from: {
            name: string | null;
            address: string | null;
        }[];
        to: {
            address: string;
        }[];
        date: string;
        flags: string[];
        snippet: string;
    }[]>;
    /**
     * Fetch Sent messages directly from database
     */
    fetchSent(limit?: number): Promise<{
        uid: string;
        seq: number;
        subject: string;
        from: {
            name: string;
            address: string | null;
        }[];
        to: {
            address: string;
        }[];
        date: string;
        flags: string[];
        snippet: string;
    }[]>;
    /**
     * Handle Webhook from Resend
     */
    handleWebhook(payload: any): Promise<{
        success: boolean;
    }>;
    /**
     * Get Unread Inbox messages count
     */
    getUnreadCount(): Promise<number>;
    /**
     * Get Message Body from database
     */
    getMessage(uid: string): Promise<{
        uid: string;
        source: string;
    }>;
    /**
     * Sync Inbox using IMAP configuration
     */
    syncInbox(): Promise<{
        success: boolean;
        count: number;
    }>;
}
export declare const mailService: MailService;
export default mailService;
//# sourceMappingURL=mail.service.d.ts.map