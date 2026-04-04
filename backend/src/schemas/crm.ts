/**
 * CRM validation schemas (Client, Dealer, Lead, Deal)
 */

import { z } from 'zod';
import { commonFields, preprocessors } from './common';

/**
 * Client Schema
 */
export const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: commonFields.email,
  phone: commonFields.phone,
  company: z.string().optional().nullable(),
  status: z.string().default('active'),
  address: z.string().optional().nullable(),
  cnic: z.string().optional().nullable(),
  assignedAgentId: commonFields.optionalUuid,
  assignedDealerId: commonFields.optionalUuid,
  billingAddress: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  clientCategory: z.string().optional().nullable(),
  clientType: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  propertyInterest: z.string().optional().nullable(),
  manualUniqueId: commonFields.manualUniqueId,
  propertySubsidiary: z.string().optional().nullable(),
  tid: commonFields.tid,
});

export const updateClientSchema = createClientSchema.partial();

/**
 * Dealer Schema
 */
export const createDealerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: commonFields.email,
  phone: commonFields.phone,
  company: z.string().optional().nullable(),
  commissionRate: z.preprocess(
    preprocessors.stringToNumber,
    z.number().optional().default(0)
  ),
  address: z.string().optional().nullable(),
  cnic: z.string().optional().nullable(),
  assignedRegion: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  experienceYears: z.preprocess(
    preprocessors.stringToNumber,
    z.number().int('Experience years must be an integer').optional().default(0)
  ),
  iban: z.string().optional().nullable(),
  isActive: z.preprocess(
    preprocessors.stringToBoolean,
    z.boolean().default(true)
  ),
  notes: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  qualifications: z.string().optional().nullable(),
  manualUniqueId: commonFields.manualUniqueId,
  tid: commonFields.tid,
});

export const updateDealerSchema = createDealerSchema.partial();

/**
 * Lead Schema
 */
export const leadPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export const leadTemperatureEnum = z.enum(['cold', 'warm', 'hot']);

export const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: commonFields.email,
  phone: commonFields.phone,
  source: z.string().optional().nullable(),
  leadSourceDetails: z.string().optional().nullable(),
  priority: leadPriorityEnum.default('medium'),
  score: z.preprocess(
    preprocessors.stringToNumber,
    z.number().int('Score must be an integer').min(0, 'Score must be between 0 and 100').max(100, 'Score must be between 0 and 100').optional()
  ),
  interest: z.string().optional().nullable(),
  interestType: z.string().optional().nullable(),
  budget: z.string().optional().nullable(),
  budgetMin: z.preprocess(
    preprocessors.stringToNumber,
    z.number().optional()
  ),
  budgetMax: z.preprocess(
    preprocessors.stringToNumber,
    z.number().optional()
  ),
  expectedCloseDate: z.string().datetime('Invalid date format').optional().nullable(),
  followUpDate: z.string().datetime('Invalid date format').optional().nullable(),
  assignedToUserId: commonFields.optionalUuid,
  assignedDealerId: commonFields.optionalUuid,
  cnic: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  manualUniqueId: commonFields.manualUniqueId,
  tid: commonFields.tid,
  status: z.string().optional().default('new'),
  notes: z.string().optional().nullable(),
  temperature: leadTemperatureEnum.optional().default('cold'),
});

export const updateLeadSchema = createLeadSchema.partial();

/**
 * Deal Schema
 */
export const dealStatusEnum = z.enum(['open', 'won', 'lost', 'closed', 'cancelled']);
export const dealStageEnum = z.enum([
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed-won',
  'closed-lost',
]);

export const createDealSchema = z.object({
  tid: commonFields.tid,
  title: z.string().min(1, 'Deal title is required'),
  clientId: commonFields.uuid,
  propertyId: commonFields.uuid,
  dealerId: commonFields.optionalUuid,
  dealAmount: z.preprocess(
    preprocessors.stringToNumber,
    z.number().positive('Deal amount must be greater than 0')
  ),
  status: dealStatusEnum.optional().default('open'),
  stage: dealStageEnum.optional(),
  description: z.string().optional().nullable(),
  expectedCloseDate: z.string().datetime('Invalid date format').optional().nullable(),
  actualCloseDate: z.string().datetime('Invalid date format').optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateDealSchema = createDealSchema.partial();

/**
 * TypeScript types
 */
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateDealerInput = z.infer<typeof createDealerSchema>;
export type UpdateDealerInput = z.infer<typeof updateDealerSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;


