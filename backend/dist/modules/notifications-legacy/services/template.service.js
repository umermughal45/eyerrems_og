"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateService = void 0;
const crypto_1 = require("crypto");
const templateRenderer_1 = require("../utils/templateRenderer");
class TemplateService {
    constructor(pool) {
        this.pool = pool;
    }
    async createTemplate(input, createdBy) {
        const id = (0, crypto_1.randomUUID)();
        const status = input.status ?? 'active';
        const variables = input.variables ?? null;
        const q = `
      INSERT INTO notification_templates (id, name, channel, module_name, template_text, variables, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, name, channel, module_name, template_text, variables, status, created_at
    `;
        const res = await this.pool.query(q, [
            id,
            input.name,
            input.channel,
            input.module_name,
            input.template_text,
            variables ? JSON.stringify(variables) : null,
            status,
        ]);
        void createdBy;
        return this.mapTemplateRow(res.rows[0]);
    }
    async getTemplateByName(name, channel, moduleName) {
        const q = `
      SELECT id, name, channel, module_name, template_text, variables, status, created_at
      FROM notification_templates
      WHERE name = $1 AND channel = $2 AND module_name = $3 AND status = 'active'
      LIMIT 1
    `;
        const res = await this.pool.query(q, [name, channel, moduleName]);
        if (res.rowCount === 0)
            return null;
        return this.mapTemplateRow(res.rows[0]);
    }
    async render(templateText, variables) {
        return (0, templateRenderer_1.renderTemplate)(templateText, variables);
    }
    mapTemplateRow(row) {
        return {
            id: String(row.id),
            name: String(row.name),
            channel: row.channel,
            module_name: String(row.module_name),
            template_text: String(row.template_text),
            variables: row.variables ?? null,
            status: String(row.status),
            created_at: row.created_at?.toISOString ? row.created_at.toISOString() : String(row.created_at),
        };
    }
}
exports.TemplateService = TemplateService;
//# sourceMappingURL=template.service.js.map