import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { requireFields, validItems } from '../utils/validation.js';
const router = Router();
router.get('/', asyncHandler(async (req,res) => {
  const r = await pool.query(`SELECT e.*,c.company_name,c.contact_person,c.mobile,c.email,c.city,
    COALESCE(json_agg(json_build_object('productId',p.id,'productName',p.product_name,'productCode',p.product_code,'quantity',ei.quantity))
    FILTER (WHERE ei.id IS NOT NULL),'[]') AS items
    FROM enquiries e JOIN customers c ON c.id=e.customer_id
    LEFT JOIN enquiry_items ei ON ei.enquiry_id=e.id LEFT JOIN products p ON p.id=ei.product_id
    GROUP BY e.id,c.id ORDER BY e.created_at DESC`);
  res.json(r.rows);
}));
router.post('/', asyncHandler(async (req,res) => {
  const b=req.body;
  requireFields(b,['companyName','contactPerson','mobile','city','enquiryDate']);
  const items=validItems(b.items);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const customer=await client.query(`INSERT INTO customers(company_name,contact_person,mobile,email,city,created_by)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [b.companyName,b.contactPerson,b.mobile,b.email||null,b.city,req.user.id]);
    const num=`ENQ-${Date.now()}`;
    const e=await client.query(`INSERT INTO enquiries(enquiry_number,customer_id,enquiry_date,required_date,notes,created_by)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[num,customer.rows[0].id,b.enquiryDate,b.requiredDate||null,b.notes||null,req.user.id]);
    for(const item of items) {
      const p=await client.query('SELECT id FROM products WHERE id=$1 AND active=true',[item.productId]);
      if(!p.rowCount) throw new AppError(400,`Product ${item.productId} not found`);
      await client.query('INSERT INTO enquiry_items(enquiry_id,product_id,quantity) VALUES($1,$2,$3)',[e.rows[0].id,item.productId,item.quantity]);
    }
    await client.query('COMMIT');
    res.status(201).json({...e.rows[0],customer_id:customer.rows[0].id});
  } catch(err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}));
export default router;
