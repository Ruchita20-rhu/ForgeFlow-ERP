import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../utils/errors.js';
import { allowRoles } from '../middleware/auth.js';
const router = Router();
router.get('/products', asyncHandler(async (req,res) => {
  const r = await pool.query(`SELECT p.id,p.product_code,p.product_name,p.category,p.unit,p.base_price,
    i.physical_quantity,i.reserved_quantity,(i.physical_quantity-i.reserved_quantity) AS available_quantity
    FROM products p JOIN inventory i ON i.product_id=p.id WHERE p.active=true ORDER BY p.product_name`);
  res.json(r.rows);
}));
router.get('/inventory', asyncHandler(async (req,res) => {
  const r = await pool.query(`SELECT p.id AS product_id,p.product_code,p.product_name,i.physical_quantity,i.reserved_quantity,
    (i.physical_quantity-i.reserved_quantity) AS available_quantity FROM products p JOIN inventory i ON i.product_id=p.id ORDER BY p.product_name`);
  res.json(r.rows);
}));
router.patch('/inventory/:productId', allowRoles('ADMIN'), asyncHandler(async (req,res) => {
  const productId = Number(req.params.productId), physical = Number(req.body.physicalQuantity);
  if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(physical) || physical < 0) {
    const { AppError } = await import('../utils/errors.js'); throw new AppError(400,'productId and physicalQuantity must be valid non-negative integers');
  }
  const r = await pool.query(`UPDATE inventory SET physical_quantity=$2,updated_at=NOW()
    WHERE product_id=$1 AND $2 >= reserved_quantity RETURNING *,
    physical_quantity-reserved_quantity AS available_quantity`, [productId,physical]);
  if (!r.rowCount) { const { AppError } = await import('../utils/errors.js'); throw new AppError(400,'Inventory not found or physical quantity cannot be below reserved quantity'); }
  res.json(r.rows[0]);
}));
export default router;
