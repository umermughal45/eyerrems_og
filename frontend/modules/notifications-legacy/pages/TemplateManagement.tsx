import React, { useState } from 'react';

type TemplatePayload = {
  name: string;
  channel: 'system' | 'email' | 'sms' | 'whatsapp';
  module_name: string;
  template_text: string;
  variables: string;
};

const MODULES = ['CRM', 'Properties', 'Finance', 'Construction', 'HR', 'Tenant Portal'] as const;
const CHANNELS = ['system', 'email', 'sms', 'whatsapp'] as const;

export default function TemplateManagement() {
  const [form, setForm] = useState<TemplatePayload>({
    name: '',
    channel: 'system',
    module_name: 'CRM',
    template_text: '',
    variables: '[]',
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-slate-900">Template Management</div>
        <div className="mt-1 text-sm text-slate-500">Create notification templates (admin)</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600">Template Name</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">Channel</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.channel}
              onChange={(e) => setForm((s) => ({ ...s, channel: e.target.value as any }))}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">Module</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.module_name}
              onChange={(e) => setForm((s) => ({ ...s, module_name: e.target.value }))}
            >
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">Variables (JSON)</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.variables}
              onChange={(e) => setForm((s) => ({ ...s, variables: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-600">Template Text</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={5}
            value={form.template_text}
            onChange={(e) => setForm((s) => ({ ...s, template_text: e.target.value }))}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            disabled={!form.name || !form.template_text}
          >
            Create Template
          </button>
        </div>
      </div>
    </div>
  );
}

