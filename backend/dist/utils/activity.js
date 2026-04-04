"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivity = createActivity;
const client_1 = __importDefault(require("../prisma/client"));
async function createActivity(params) {
    try {
        // Check if Activity model exists in Prisma client
        if (client_1.default.activity) {
            await client_1.default.activity.create({
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
        }
        else {
            console.warn('Activity model not available. Run: npx prisma generate && npx prisma migrate dev');
        }
    }
    catch (error) {
        // Don't throw error if activity logging fails
        console.error('Failed to log activity:', error);
    }
}
//# sourceMappingURL=activity.js.map