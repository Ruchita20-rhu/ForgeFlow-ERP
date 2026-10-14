import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuotation } from '../src/services/quotation.js';

test('quotation total applies discount before GST', () => {
  const result=calculateQuotation([{productId:1,quantity:2,unitPrice:100,discountPercent:10,gstPercent:18}]);
  assert.equal(result.subtotal,'200.00');
  assert.equal(result.discountTotal,'20.00');
  assert.equal(result.taxTotal,'32.40');
  assert.equal(result.grandTotal,'212.40');
});
test('quotation rejects invalid discount', () => {
  assert.throws(()=>calculateQuotation([{productId:1,quantity:1,unitPrice:100,discountPercent:101,gstPercent:18}]),/Discount/);
});
