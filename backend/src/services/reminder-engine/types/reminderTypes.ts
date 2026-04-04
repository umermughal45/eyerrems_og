export type ReminderStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type NotificationChannel = 'system' | 'email' | 'sms';

export interface ReminderJobPayload {
  reminderId: string;
  recipientId: string;
  channel: NotificationChannel;
  message: string;
  attempt?: number;
}

export interface DomainEventPayloadBase {
  moduleName: string;
  entityId?: string;
  title?: string;
  description?: string;
  // Optional cross-cutting metadata used by automation + routing
  assignedUserId?: string;
  userId?: string;
  createdBy?: string;
}

export interface InvoiceGeneratedPayload extends DomainEventPayloadBase {
  invoiceId: string;
}

export interface LeadCreatedPayload extends DomainEventPayloadBase {
  leadId: string;
}

export interface LeaseExpiringPayload extends DomainEventPayloadBase {
  leaseId: string;
}

export interface MaintenanceRequestedPayload extends DomainEventPayloadBase {
  requestId: string;
}

export type DomainEventPayloadMap = {
  InvoiceGenerated: InvoiceGeneratedPayload;
  LeadCreated: LeadCreatedPayload;
  LeaseExpiring: LeaseExpiringPayload;
  MaintenanceRequested: MaintenanceRequestedPayload;
  // Fallback for custom events
  [eventName: string]: DomainEventPayloadBase | undefined;
};

