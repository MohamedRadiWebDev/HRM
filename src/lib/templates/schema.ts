export type ColumnDefinition = {
  excelColumn: string;
  headerArabic: string;
  headerEnglish?: string;
  dataType: 'text' | 'number' | 'date' | 'time' | 'datetime';
  format?: string;
  required?: boolean;
};

export type TemplateDefinition = {
  id: string;
  name_ar: string;
  description?: string;
  columns: ColumnDefinition[];
  type: 'ATTENDANCE' | 'SUMMARY';
};
