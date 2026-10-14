import test from 'node:test';
import assert from 'node:assert/strict';
import { allowRoles } from '../src/middleware/auth.js';

test('unauthorized role cannot pass ADMIN authorization middleware', () => {
  const req={user:{role:'SALES'}};
  let nextError=null;
  allowRoles('ADMIN')(req,{},err=>{nextError=err;});
  assert.equal(nextError?.status,403);
  assert.match(nextError?.message,/permission/);
});
