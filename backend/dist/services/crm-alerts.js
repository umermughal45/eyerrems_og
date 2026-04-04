"use strict";
/**
 * CRM Alerts Service
 * Handles follow-up reminders and alerts for leads, clients, and deals
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFollowUpReminders = getFollowUpReminders;
exports.getOverdueFollowUps = getOverdueFollowUps;
exports.updateLeadFollowUpDate = updateLeadFollowUpDate;
exports.markReminderCompleted = markReminderCompleted;
const client_1 = __importDefault(require("../prisma/client"));
/**
 * Get follow-up reminders that are due
 */
async function getFollowUpReminders(agentId) {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const where = {
        isDeleted: false,
        nextFollowUpDate: {
            lte: tomorrow,
            gte: today,
        },
    };
    if (agentId) {
        where.assignedAgentId = agentId;
    }
    // Get leads with follow-up due
    const leads = await client_1.default.lead.findMany({
        where: {
            ...where,
            status: { notIn: ['converted', 'lost', 'won'] },
        },
        include: {
            assignedAgent: {
                select: {
                    id: true,
                    email: true,
                },
            },
        },
        orderBy: { followUpDate: 'asc' },
    });
    // Get communications with follow-up due
    const communications = await client_1.default.communication.findMany({
        where: {
            ...where,
            reminderEnabled: true,
        },
        include: {
            lead: {
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    leadCode: true,
                },
            },
            client: {
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    clientCode: true,
                },
            },
            deal: {
                select: {
                    id: true,
                    title: true,
                    dealCode: true,
                    stage: true,
                },
            },
            assignedAgent: {
                select: {
                    id: true,
                    email: true,
                },
            },
        },
        orderBy: { nextFollowUpDate: 'asc' },
    });
    // Get deals with expected closing date approaching
    const dealsClosingSoon = await client_1.default.deal.findMany({
        where: {
            isDeleted: false,
            stage: { notIn: ['closed-won', 'closed-lost'] },
            expectedClosingDate: {
                lte: tomorrow,
                gte: today,
            },
        },
        include: {
            client: {
                select: {
                    id: true,
                    email: true,
                    phone: true,
                },
            },
            dealer: {
                select: {
                    id: true,
                },
            },
            property: {
                select: {
                    id: true,
                    propertyCode: true,
                },
            },
        },
        orderBy: { expectedClosingDate: 'asc' },
    });
    // Categorize reminders
    const overdue = leads.filter((lead) => {
        if (!lead.followUpDate)
            return false;
        return lead.followUpDate < today;
    });
    const dueToday = leads.filter((lead) => {
        if (!lead.followUpDate)
            return false;
        const leadDate = new Date(lead.followUpDate);
        return (leadDate.getDate() === today.getDate() &&
            leadDate.getMonth() === today.getMonth() &&
            leadDate.getFullYear() === today.getFullYear());
    });
    const dueTomorrow = leads.filter((lead) => {
        if (!lead.followUpDate)
            return false;
        const leadDate = new Date(lead.followUpDate);
        return (leadDate.getDate() === tomorrow.getDate() &&
            leadDate.getMonth() === tomorrow.getMonth() &&
            leadDate.getFullYear() === tomorrow.getFullYear());
    });
    return {
        leads: {
            overdue,
            dueToday,
            dueTomorrow,
            total: leads.length,
        },
        communications: {
            due: communications,
            total: communications.length,
        },
        dealsClosingSoon: {
            deals: dealsClosingSoon,
            total: dealsClosingSoon.length,
        },
        summary: {
            totalReminders: leads.length + communications.length + dealsClosingSoon.length,
            overdueCount: overdue.length,
            dueTodayCount: dueToday.length,
            dueTomorrowCount: dueTomorrow.length,
        },
    };
}
/**
 * Get overdue follow-ups (past due date)
 */
async function getOverdueFollowUps(agentId) {
    const today = new Date();
    const where = {
        isDeleted: false,
        followUpDate: { lt: today },
        status: { notIn: ['converted', 'lost', 'won'] },
    };
    if (agentId) {
        where.assignedToUserId = agentId;
    }
    const overdueLeads = await client_1.default.lead.findMany({
        where,
        include: {
            assignedAgent: {
                select: {
                    id: true,
                    email: true,
                },
            },
        },
        orderBy: { followUpDate: 'asc' },
    });
    const overdueCommunications = await client_1.default.communication.findMany({
        where: {
            isDeleted: false,
            nextFollowUpDate: { lt: today },
            reminderEnabled: true,
        },
        include: {
            lead: true,
            client: true,
            deal: true,
            assignedAgent: {
                select: {
                    id: true,
                    email: true,
                },
            },
        },
        orderBy: { nextFollowUpDate: 'asc' },
    });
    return {
        leads: overdueLeads,
        communications: overdueCommunications,
        total: overdueLeads.length + overdueCommunications.length,
    };
}
/**
 * Update lead follow-up date
 */
async function updateLeadFollowUpDate(leadId, followUpDate) {
    return await client_1.default.lead.update({
        where: { id: leadId },
        data: { followUpDate },
    });
}
/**
 * Mark communication reminder as completed
 */
async function markReminderCompleted(communicationId) {
    return await client_1.default.communication.update({
        where: { id: communicationId },
        data: {
            reminderEnabled: false,
            nextFollowUpDate: null,
        },
    });
}
//# sourceMappingURL=crm-alerts.js.map