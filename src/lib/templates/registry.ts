import type { TemplateDefinition } from './schema';

const registry = new Map<string, TemplateDefinition>();
let defaultTemplateId: string | null = null;

export const registerTemplate = (template: TemplateDefinition) => {
  registry.set(template.id, template);
  if (!defaultTemplateId) defaultTemplateId = template.id;
};

export const listTemplates = () => Array.from(registry.values());

export const setDefaultTemplate = (templateId: string) => {
  if (registry.has(templateId)) defaultTemplateId = templateId;
};

export const getDefaultTemplate = () => (defaultTemplateId ? registry.get(defaultTemplateId) ?? null : null);

export const getTemplateById = (templateId: string) => registry.get(templateId) ?? null;

export const removeTemplate = (templateId: string) => {
  registry.delete(templateId);
  if (defaultTemplateId === templateId) {
    defaultTemplateId = registry.size ? Array.from(registry.keys())[0] : null;
  }
};
