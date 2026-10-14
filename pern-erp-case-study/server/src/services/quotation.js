import { AppError } from '../utils/errors.js';
import { validItems } from '../utils/validation.js';

// Use integer cents for predictable arithmetic; return two-decimal numbers for PostgreSQL.
const cents = n => Math.round(Number(n) * 100);
const money = n => (n / 100).toFixed(2);
export function calculateQuotation(items) {
  if (!Array.isArray(items) || items.length === 0) throw new AppError(400, 'At least one quotation item is required');
  let subtotal = 0, discountTotal = 0, taxTotal = 0;
  const lines = items.map(item => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const discountPercent = Number(item.discountPercent ?? 0);
    const gstPercent = Number(item.gstPercent ?? 18);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new AppError(400, 'Quantity must be a positive integer');
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new AppError(400, 'Unit price must be non-negative');
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new AppError(400, 'Discount must be between 0 and 100');
    if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) throw new AppError(400, 'GST must be between 0 and 100');
    const base = quantity * cents(unitPrice);
    const discount = Math.round(base * discountPercent / 100);
    const taxable = base - discount;
    const tax = Math.round(taxable * gstPercent / 100);
    const line = taxable + tax;
    subtotal += base; discountTotal += discount; taxTotal += tax;
    return {
      productId: Number(item.productId), quantity, unitPrice: money(cents(unitPrice)),
      discountPercent, gstPercent, baseAmount: money(base), discountAmount: money(discount),
      taxAmount: money(tax), lineAmount: money(line)
    };
  });
  return { lines, subtotal: money(subtotal), discountTotal: money(discountTotal), taxTotal: money(taxTotal),
    grandTotal: money(subtotal - discountTotal + taxTotal) };
}
