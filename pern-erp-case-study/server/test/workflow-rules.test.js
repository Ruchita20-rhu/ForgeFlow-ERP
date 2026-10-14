import test from 'node:test';
import assert from 'node:assert/strict';

// These pure policy tests complement database-backed verification during local demo.
function canConvert(status, alreadyConverted=false) {
  if(status!=='ACCEPTED') return {ok:false,reason:'Only ACCEPTED quotations can be converted'};
  if(alreadyConverted) return {ok:false,reason:'This quotation already has a Sales Order'};
  return {ok:true};
}
function canReserve(physical,reserved,quantity) {
  return Number.isInteger(quantity)&&quantity>0&&physical-reserved>=quantity;
}
test('DRAFT and REJECTED quotations cannot create orders',()=>{
  assert.equal(canConvert('DRAFT').ok,false);
  assert.equal(canConvert('REJECTED').ok,false);
});
test('same quotation cannot create duplicate sales orders',()=>{
  assert.equal(canConvert('ACCEPTED',true).ok,false);
});
test('reservation cannot exceed available inventory',()=>{
  assert.equal(canReserve(100,30,71),false);
  assert.equal(canReserve(100,30,70),true);
});
test('invalid zero/negative inventory reservation is rejected',()=>{
  assert.equal(canReserve(100,0,0),false);
  assert.equal(canReserve(100,0,-1),false);
});
