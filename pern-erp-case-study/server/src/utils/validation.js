import { AppError } from './errors.js';
export function requireFields(body, fields) {
  const missing = fields.filter(k => body[k] === undefined || body[k] === null || body[k] === '');
  if (missing.length) throw new AppError(400, `Required fields: ${missing.join(', ')}`);
}
export function positiveInt(value, field='quantity') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(400, `${field} must be a positive integer`);
  return n;
}
export function validItems(items) {
  if (!Array.isArray(items) || !items.length) throw new AppError(400, 'At least one product item is required');
  const seen = new Set();
  return items.map(item => {
    const productId = Number(item.productId);
    if (!Number.isInteger(productId) || productId <= 0) throw new AppError(400, 'Invalid productId');
    if (seen.has(productId)) throw new AppError(400, 'A product can appear only once per document');
    seen.add(productId);
    return { productId, quantity: positiveInt(item.quantity) };
  });
}
