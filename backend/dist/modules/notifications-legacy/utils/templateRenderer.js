"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
const VAR_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
function getPath(obj, path) {
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) {
            cur = cur[p];
        }
        else {
            return undefined;
        }
    }
    return cur;
}
function renderTemplate(templateText, variables) {
    const missing = new Set();
    const text = templateText.replace(VAR_RE, (_m, key) => {
        const val = getPath(variables, key);
        if (val === undefined || val === null) {
            missing.add(key);
            return '';
        }
        if (typeof val === 'string')
            return val;
        if (typeof val === 'number' || typeof val === 'boolean')
            return String(val);
        return JSON.stringify(val);
    });
    return { text, missingVariables: Array.from(missing) };
}
//# sourceMappingURL=templateRenderer.js.map