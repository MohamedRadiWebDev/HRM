import type { TemplateDefinition } from './schema';

export type TemplateValidationResult = {
  errors: string[];
  warnings: string[];
};

export const validateTemplate = (template: TemplateDefinition, requiredHeaders: string[] = []): TemplateValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const headers = template.columns.map((column) => column.headerArabic);

  requiredHeaders.forEach((header) => {
    if (!headers.includes(header)) warnings.push(`عمود مفقود: ${header}`);
  });

  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length) errors.push(`أعمدة مكررة: ${duplicates.join('، ')}`);

  return { errors, warnings };
};
