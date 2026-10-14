import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { requireFields } from '../utils/validation.js';
const router = Router();
router.post('/login', asyncHandler(async (req,res) => {
  requireFields(req.body, ['email','password']);
  const result = await pool.query('SELECT id,name,email,password_hash,role FROM users WHERE lower(email)=lower($1)', [req.body.email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) throw new AppError(401, 'Invalid email or password');
  const token = jwt.sign({ id:user.id, name:user.name, email:user.email, role:user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  res.json({ token, user: { id:user.id, name:user.name, email:user.email, role:user.role } });
}));
export default router;
