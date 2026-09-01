import { CustomFieldDefinition } from '@billing/shared';

export interface ValidationResult {
  isValid: boolean;
  errors: { field: string; message: string }[];
}

export function validateCustomFields(
  definitions: CustomFieldDefinition[],
  data: Record<string, any> = {}
): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  for (const def of definitions) {
    const value = data[def.fieldName];

    // Check required
    if (def.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: def.fieldName,
        message: `Field '${def.label}' is required.`,
      });
      continue;
    }

    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Check types
    switch (def.fieldType) {
      case 'number':
        if (isNaN(Number(value))) {
          errors.push({
            field: def.fieldName,
            message: `Field '${def.label}' must be a valid number.`,
          });
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push({
            field: def.fieldName,
            message: `Field '${def.label}' must be a boolean.`,
          });
        }
        break;
      case 'select':
        if (def.options && def.options.length > 0 && !def.options.includes(String(value))) {
          errors.push({
            field: def.fieldName,
            message: `Field '${def.label}' must be one of: ${def.options.join(', ')}.`,
          });
        }
        break;
      case 'text':
      case 'textarea':
        if (def.validationRegex) {
          try {
            const regex = new RegExp(def.validationRegex);
            if (!regex.test(String(value))) {
              errors.push({
                field: def.fieldName,
                message: `Field '${def.label}' does not match the required format.`,
              });
            }
          } catch (e) {
            // ignore invalid regex
          }
        }
        break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
