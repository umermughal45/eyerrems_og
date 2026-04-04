import prisma from '../prisma/client';

export interface CreateActivityParams {
  type:
    | 'property'
    | 'unit'
    | 'tenant'
    | 'lease'
    | 'sale'
    | 'buyer'
    | 'block'
    | 'lead'
    | 'client'
    | 'deal'
    | 'dealer'
    | 'communication';
  action: 'created' | 'updated' | 'deleted';
  entityId: string;
  entityName?: string;
  message: string;
  userId?: string;
  metadata?: any;
}

export async function createActivity(params: CreateActivityParams) {
  try {
    // Check if Activity model exists in Prisma client
    if (prisma.activity) {
      await prisma.activity.create({
        data: {
          type: params.type,
          action: params.action,
          entityId: params.entityId,
          entityName: params.entityName,
          message: params.message,
          userId: params.userId,
          metadata: params.metadata || {},
        },
      });
    } else {
      console.warn('Activity model not available. Run: npx prisma generate && npx prisma migrate dev');
    }
  } catch (error) {
    // Don't throw error if activity logging fails
    console.error('Failed to log activity:', error);
  }
}

