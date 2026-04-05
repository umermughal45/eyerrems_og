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
    fetchInbox(limit?: number): Promise<any>;
    /**
     * Fetch Sent messages directly from database
     */
    fetchSent(limit?: number): Promise<any>;
    /**
     * Handle Webhook from Resend
     */
    handleWebhook(payload: any): Promise<{
        success: boolean;
    }>;
    /**
     * Get Unread Inbox messages count
     */
    getUnreadCount(): Promise<any>;
    /**
     * Get Message Body from database
     */
    getMessage(uid: string): Promise<{
        uid: any;
        source: any;
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