import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { requireFields } from '../utils/validation.js';
import { calculateQuotation } from '../services/quotation.js';
const router=Router();
router.get('/',asyncHandler(async(req,res)=>{
 const r=await pool.query(`SELECT q.*,e.enquiry_number,c.company_name,
 COALESCE(json_agg(json_build_object('productId',p.id,'productName',p.product_name,'quantity',qi.quantity,
 'unitPrice',qi.unit_price,'discountPercent',qi.discount_percent,'gstPercent',qi.gst_percent,'lineAmount',qi.line_amount))
 FILTER(WHERE qi.id IS NOT NULL),'[]') AS items
 FROM quotations q JOIN enquiries e ON e.id=q.enquiry_id JOIN customers c ON c.id=e.customer_id
 LEFT JOIN quotation_items qi ON qi.quotation_id=q.id LEFT JOIN products p ON p.id=qi.product_id
 GROUP BY q.id,e.id,c.id ORDER BY q.created_at DESC`);
 res.json(r.rows);
}));
router.post('/',asyncHandler(async(req,res)=>{
 const b=req.body; requireFields(b,['enquiryId']);
 if(!Array.isArray(b.items)||!b.items.length) throw new AppError(400,'Quotation items are required');
 const calc=calculateQuotation(b.items);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const e=await client.query('SELECT * FROM enquiries WHERE id=$1 FOR UPDATE',[Number(b.enquiryId)]);
  if(!e.rowCount) throw new AppError(404,'Enquiry not found');
  if(e.rows[0].status!=='NEW') throw new AppError(400,'Only NEW enquiries can be quoted');
  const enqItems=await client.query('SELECT product_id,quantity FROM enquiry_items WHERE enquiry_id=$1',[b.enquiryId]);
  const allowed=new Map(enqItems.rows.map(x=>[x.product_id,x.quantity]));
  for(const item of calc.lines) {
    if(!allowed.has(item.productId)||item.quantity>allowed.get(item.productId)) throw new AppError(400,'Quotation products and quantities must match the enquiry');
    const p=await client.query('SELECT id FROM products WHERE id=$1 AND active=true',[item.productId]);
    if(!p.rowCount) throw new AppError(400,`Product ${item.productId} not found`);
  }
  const q=await client.query(`INSERT INTO quotations(quotation_number,enquiry_id,valid_until,status,subtotal,discount_total,tax_total,grand_total,created_by)
   VALUES($1,$2,$3,'DRAFT',$4,$5,$6,$7,$8) RETURNING *`,
   [`QUO-${Date.now()}`,b.enquiryId,b.validUntil||null,calc.subtotal,calc.discountTotal,calc.taxTotal,calc.grandTotal,req.user.id]);
  for(const l of calc.lines) await client.query(`INSERT INTO quotation_items(quotation_id,product_id,quantity,unit_price,discount_percent,gst_percent,base_amount,discount_amount,tax_amount,line_amount)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[q.rows[0].id,l.productId,l.quantity,l.unitPrice,l.discountPercent,l.gstPercent,l.baseAmount,l.discountAmount,l.taxAmount,l.lineAmount]);
  await client.query("UPDATE enquiries SET status='QUOTED' WHERE id=$1",[b.enquiryId]);
  await client.query('COMMIT'); res.status(201).json({...q.rows[0],items:calc.lines});
 }catch(err){await client.query('ROLLBACK');throw err;}finally{client.release();}
}));
router.patch('/:id/status',asyncHandler(async(req,res)=>{
 const status=String(req.body.status||'').toUpperCase();
 if(!['SENT','ACCEPTED','REJECTED'].includes(status)) throw new AppError(400,'Status must be SENT, ACCEPTED, or REJECTED');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const q=await client.query('SELECT * FROM quotations WHERE id=$1 FOR UPDATE',[req.params.id]);
  if(!q.rowCount) throw new AppError(404,'Quotation not found');
  const current=q.rows[0].status;
  const transitions={DRAFT:['SENT','REJECTED'],SENT:['ACCEPTED','REJECTED'],ACCEPTED:[],REJECTED:[]};
  if(!transitions[current]?.includes(status)) throw new AppError(400,`Cannot change quotation from ${current} to ${status}`);
  const updated=await client.query('UPDATE quotations SET status=$2 WHERE id=$1 RETURNING *',[req.params.id,status]);
  if(status==='ACCEPTED') await client.query("UPDATE enquiries SET status='WON' WHERE id=$1",[q.rows[0].enquiry_id]);
  if(status==='REJECTED') await client.query("UPDATE enquiries SET status='LOST' WHERE id=$1",[q.rows[0].enquiry_id]);
  await client.query('COMMIT');res.json(updated.rows[0]);
 }catch(err){await client.query('ROLLBACK');throw err;}finally{client.release();}
}));
router.post('/:id/convert',asyncHandler(async(req,res)=>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const q=await client.query('SELECT * FROM quotations WHERE id=$1 FOR UPDATE',[req.params.id]);
  if(!q.rowCount) throw new AppError(404,'Quotation not found');
  if(q.rows[0].status!=='ACCEPTED') throw new AppError(400,'Only ACCEPTED quotations can be converted');
  const existing=await client.query('SELECT id FROM sales_orders WHERE quotation_id=$1',[q.rows[0].id]);
  if(existing.rowCount) throw new AppError(409,'This quotation already has a Sales Order');
  const e=await client.query('SELECT customer_id FROM enquiries WHERE id=$1',[q.rows[0].enquiry_id]);
  const order=await client.query(`INSERT INTO sales_orders(order_number,quotation_id,customer_id,total_amount,created_by)
    VALUES($1,$2,$3,$4,$5) RETURNING *`,[`SO-${Date.now()}`,q.rows[0].id,e.rows[0].customer_id,q.rows[0].grand_total,req.user.id]);
  const lines=await client.query('SELECT product_id,quantity,unit_price FROM quotation_items WHERE quotation_id=$1',[q.rows[0].id]);
  for(const l of lines.rows) await client.query('INSERT INTO sales_order_items(sales_order_id,product_id,quantity,unit_price) VALUES($1,$2,$3,$4)',[order.rows[0].id,l.product_id,l.quantity,l.unit_price]);
  await client.query('COMMIT');res.status(201).json(order.rows[0]);
 }catch(err){await client.query('ROLLBACK');throw err;}finally{client.release();}
}));
export default router;
