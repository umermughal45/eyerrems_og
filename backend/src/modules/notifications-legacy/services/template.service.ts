import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { CreateTemplateInput, NotificationTemplateModel, NotificationChannel } from '../types/notification.types';
import { renderTemplate } from '../utils/templateRenderer';

export class TemplateService {
  constructor(private readonly pool: Pool) {}

  async createTemplate(input: CreateTemplateInput, createdBy?: string): Promise<NotificationTemplateModel> {
    const id = randomUUID();
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

  async getTemplateByName(name: string, channel: NotificationChannel, moduleName: string): Promise<NotificationTemplateModel | null> {
    const q = `
      SELECT id, name, channel, module_name, template_text, variables, status, created_at
      FROM notification_templates
      WHERE name = $1 AND channel = $2 AND module_name = $3 AND status = 'active'
      LIMIT 1
    `;
    const res = await this.pool.query(q, [name, channel, moduleName]);
    if (res.rowCount === 0) return null;
    return this.mapTemplateRow(res.rows[0]);
  }

  async render(templateText: string, variables: Record<string, unknown>) {
    return renderTemplate(templateText, variables);
  }

  private mapTemplateRow(row: any): NotificationTemplateModel {
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

