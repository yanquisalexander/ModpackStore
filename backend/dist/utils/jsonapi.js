"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeResource = serializeResource;
exports.serializeCollection = serializeCollection;
exports.serializeError = serializeError;
exports.deserializeResource = deserializeResource;
const jsonapi_serializer_1 = require("jsonapi-serializer");
function serializeResource(type, data, options) {
    if (!data)
        return { data: null };
    // Ensure id is a string as required by jsonapi-serializer
    const serializedData = Array.isArray(data)
        ? data.map(item => (Object.assign(Object.assign({}, item), { id: String(item.id) })))
        : Object.assign(Object.assign({}, data), { id: String(data.id) });
    return new jsonapi_serializer_1.Serializer(type, Object.assign({ attributes: Object.keys(serializedData).filter(key => key !== 'id' && !key.endsWith('Id') && key !== 'passwordHash'), keyForAttribute: 'camelCase', transform: (record) => {
            // Remove null or undefined attributes
            const attributes = {};
            for (const key in record) {
                if (record[key] !== null && record[key] !== undefined && key !== 'id' && !key.endsWith('Id') && key !== 'passwordHash') {
                    attributes[key] = record[key];
                }
            }
            return attributes;
        } }, options)).serialize(serializedData);
}
function serializeCollection(type, data, options) {
    if (!data || data.length === 0)
        return { data: [] };
    // Ensure id is a string for all items in the collection
    const serializedData = data.map(item => (Object.assign(Object.assign({}, item), { id: String(item.id) })));
    return new jsonapi_serializer_1.Serializer(type, Object.assign({ attributes: Object.keys(serializedData[0] || {}).filter(key => !key.endsWith('Id') && key !== 'passwordHash'), keyForAttribute: 'camelCase', transform: (record) => {
            // Remove null or undefined attributes
            const attributes = {};
            for (const key in record) {
                if (record[key] !== null && record[key] !== undefined && !key.endsWith('Id') && key !== 'passwordHash') {
                    attributes[key] = record[key];
                }
            }
            return attributes;
        } }, options)).serialize(serializedData);
}
function serializeError(errors) {
    if (!Array.isArray(errors)) {
        errors = [errors];
    }
    return new jsonapi_serializer_1.Error(errors.map(err => ({
        status: err.status || '500',
        title: err.title || 'Internal Server Error',
        detail: err.detail || 'An unexpected error occurred.',
        code: err.code,
        source: err.source,
        meta: err.meta,
    })));
}
// Basic Deserializer for completeness, may need customization
function deserializeResource(type, data) {
    return new jsonapi_serializer_1.Deserializer({ keyForAttribute: 'camelCase' }).deserialize(data);
}
