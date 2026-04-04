import type { TemplateRenderResult } from '../types/notification.types';

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function getPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function renderTemplate(templateText: string, variables: Record<string, unknown>): TemplateRenderResult {
  const missing = new Set<string>();

  const text = templateText.replace(VAR_RE, (_m, key: string) => {
    const val = getPath(variables, key);
    if (val === undefined || val === null) {
      missing.add(key);
      return '';
    }
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return JSON.stringify(val);
  });

  return { text, missingVariables: Array.from(missing) };
}

