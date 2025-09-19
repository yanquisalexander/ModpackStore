import { Serializer, Deserializer, Error } from 'jsonapi-serializer';

interface ErrorOptions {
  status?: string;
  title?: string;
  detail?: string;
  code?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
  meta?: any;
}

export function serializeResource(type: string, data: any, options?: any) {
  if (!data) return { data: null };
  // Ensure id is a string as required by jsonapi-serializer
  const serializedData = Array.isArray(data)
    ? data.map(item => ({ ...item, id: String(item.id) }))
    : { ...data, id: String(data.id) };

  return new Serializer(type, {
    attributes: Object.keys(serializedData).filter(key => {
      // Include important ID fields even if they end with 'Id'
      const importantIdFields = ['publisherId', 'modpackId', 'userId', 'categoryId'];
      return key !== 'id' && (!key.endsWith('Id') || importantIdFields.includes(key)) && key !== 'passwordHash';
    }),
    keyForAttribute: 'camelCase',
    nullIfMissing: false, // Include null values for missing attributes
    transform: (record: any) => {
      // Remove null or undefined attributes, but keep important ID fields
      const attributes: any = {};
      const importantIdFields = ['publisherId', 'modpackId', 'userId', 'categoryId'];

      for (const key in record) {
        if ((record[key] !== null && record[key] !== undefined) || importantIdFields.includes(key)) {
          if (key !== 'id' && (!key.endsWith('Id') || importantIdFields.includes(key)) && key !== 'passwordHash') {
            attributes[key] = record[key];
          }
        }
      }
      return attributes;
    },
    ...options,
  }).serialize(serializedData);
}

export function serializeCollection(type: string, data: any[], options?: any) {
  if (!data || data.length === 0) return { data: [] };
  // Ensure id is a string for all items in the collection
  const serializedData = data.map(item => ({ ...item, id: String(item.id) }));

  return new Serializer(type, {
    attributes: Object.keys(serializedData[0] || {}).filter(key => {
      // Include important ID fields even if they end with 'Id'
      const importantIdFields = ['publisherId', 'modpackId', 'userId', 'categoryId'];
      return !key.endsWith('Id') || importantIdFields.includes(key);
    }).filter(key => key !== 'passwordHash'),
    keyForAttribute: 'camelCase',
    nullIfMissing: false, // Include null values for missing attributes
    transform: (record: any) => {
      // Remove null or undefined attributes, but keep important ID fields
      const attributes: any = {};
      const importantIdFields = ['publisherId', 'modpackId', 'userId', 'categoryId'];

      for (const key in record) {
        if ((record[key] !== null && record[key] !== undefined) || importantIdFields.includes(key)) {
          if ((!key.endsWith('Id') || importantIdFields.includes(key)) && key !== 'passwordHash') {
            attributes[key] = record[key];
          }
        }
      }
      return attributes;
    },
    ...options,
  }).serialize(serializedData);
}

export function serializeError(errors: ErrorOptions | ErrorOptions[]) {
  if (!Array.isArray(errors)) {
    errors = [errors];
  }
  return new Error(errors.map(err => ({
    status: err.status || '500',
    title: err.title || 'Internal Server Error',
    detail: err.detail || 'An unexpected error occurred.',
    code: err.code,
    source: err.source,
    meta: err.meta,
  })));
}

// Basic Deserializer for completeness, may need customization
export function deserializeResource(type: string, data: any) {
  return new Deserializer({ keyForAttribute: 'camelCase' }).deserialize(data);
}
