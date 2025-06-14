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
    attributes: Object.keys(serializedData).filter(key => key !== 'id' && !key.endsWith('Id') && key !== 'passwordHash'), // Exclude id, foreign keys, and sensitive fields
    keyForAttribute: 'camelCase',
    transform: (record: any) => {
      // Remove null or undefined attributes
      const attributes: any = {};
      for (const key in record) {
        if (record[key] !== null && record[key] !== undefined && key !== 'id' && !key.endsWith('Id') && key !== 'passwordHash') {
          attributes[key] = record[key];
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
    attributes: Object.keys(serializedData[0] || {}).filter(key => key !== 'id' && !key.endsWith('Id') && key !== 'passwordHash'),
    keyForAttribute: 'camelCase',
    transform: (record: any) => {
      // Remove null or undefined attributes
      const attributes: any = {};
      for (const key in record) {
        if (record[key] !== null && record[key] !== undefined && key !== 'id' && !key.endsWith('Id') && key !== 'passwordHash') {
          attributes[key] = record[key];
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
