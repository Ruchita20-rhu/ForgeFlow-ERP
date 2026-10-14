import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { allowRoles } from '../middleware/auth.js';
import { requireFields } from '../utils/validation.js';
const router=Router();
router.get('/',asyncHandler(async(req,res)=>{
 const r=await pool.query(`SELECT so.*,c.company_name,q.quotation_number,
 COALESCE(json_agg(json_build_object('productId',p.id,'productName',p.product_name,'productCode',p.product_code,
 'quantity',si.quantity,'unitPrice',si.unit_price)) FILTER(WHERE si.id IS NOT NULL),'[]') AS items,
 d.dispatch_number,d.dispatch_date,d.vehicle_number,d.driver_name
 FROM sales_orders so JOIN customers c ON c.id=so.customer_id JOIN quotations q ON q.id=so.quotation_id
 LEFT JOIN sales_order_items si ON si.sales_order_id=so.id LEFT JOIN products p ON p.id=si.product_id
 LEFT JOIN dispatches d ON d.sales_order_id=so.id
 GROUP BY so.id,c.id,q.id,d.id ORDER BY so.created_at DESC`);
 res.json(r.rows);
}));
router.post('/:id/confirm',allowRoles('ADMIN'),asyncHandler(async(req,res)=>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const o=await client.query('SELECT * FROM sales_orders WHERE id=$1 FOR UPDATE',[req.params.id]);
  if(!o.rowCount) throw new AppError(404,'Sales Order not found');
  if(o.rows[0].status!=='PENDING') throw new AppError(400,'Only PENDING orders can be confirmed');
  const lines=await client.query('SELECT product_id,quantity FROM sales_order_items WHERE sales_order_id=$1 ORDER BY product_id',[req.params.id]);
  // Lock all required inventory rows in a stable order to serialize competing reservations.
  const ids=lines.rows.map(l=>l.product_id);
  const stock=await client.query('SELECT product_id,physical_quantity,reserved_quantity FROM inventory WHERE product_id=ANY($1::int[]) ORDER BY product_id FOR UPDATE',[ids]);
  const stockById=new Map(stock.rows.map(s=>[s.product_id,s]));
  for(const line of lines.rows){
    const s=stockById.get(line.product_id);
    if(!s) throw new AppError(400,`Inventory missing for product ${line.product_id}`);
    const available=Number(s.physical_quantity)-Number(s.reserved_quantity);
    if(available<Number(line.quantity)) throw new AppError(409,`Insufficient stock for product ${line.product_id}. Available: ${available}, required: ${line.quantity}`);
  }
  for(const line of lines.rows) await client.query('UPDATE inventory SET reserved_quantity=reserved_quantity+$2,updated_at=NOW() WHERE product_id=$1',[line.product_id,line.quantity]);
  const updated=await client.query("UPDATE sales_orders SET status='CONFIRMED',confirmed_at=NOW() WHERE id=$1 RETURNING *",[req.params.id]);
  await client.query('COMMIT');res.json(updated.rows[0]);
 }catch(err){await client.query('ROLLBACK');throw err;}finally{client.release();}
}));
router.post('/:id/dispatch',allowRoles('ADMIN'),asyncHandler(async(req,res)=>{
 requireFields(req.body,['vehicleNumber','driverName']);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const o=await client.query('SELECT * FROM sales_orders WHERE id=$1 FOR UPDATE',[req.params.id]);
  if(!o.rowCount) throw new AppError(404,'Sales Order not found');
  if(o.rows[0].status!=='CONFIRMED') throw new AppError(400,'Only CONFIRMED orders can be dispatched');
  const lines=await client.query('SELECT product_id,quantity FROM sales_order_items WHERE sales_order_id=$1 ORDER BY product_id',[req.params.id]);
  const ids=lines.rows.map(l=>l.product_id);
  const stock=await client.query('SELECT product_id,physical_quantity,reserved_quantity FROM inventory WHERE product_id=ANY($1::int[]) ORDER BY product_id FOR UPDATE',[ids]);
  const byId=new Map(stock.rows.map(s=>[s.product_id,s]));
  for(const line of lines.rows){
   const s=byId.get(line.product_id);
   if(!s || Number(s.reserved_quantity)<Number(line.quantity) || Number(s.physical_quantity)<Number(line.quantity))
    throw new AppError(409,`Reserved stock is insufficient for product ${line.product_id}`);
  }
  const d=await client.query(`INSERT INTO dispatches(dispatch_number,sales_order_id,vehicle_number,driver_name,created_by)
   VALUES($1,$2,$3,$4,$5) RETURNING *`,[`DSP-${Date.now()}`,req.params.id,req.body.vehicleNumber,req.body.driverName,req.user.id]);
  for(const l of lines.rows){
   await client.query('UPDATE inventory SET physical_quantity=physical_quantity-$2,reserved_quantity=reserved_quantity-$2,updated_at=NOW() WHERE product_id=$1',[l.product_id,l.quantity]);
   await client.query('INSERT INTO dispatch_items(dispatch_id,product_id,quantity) VALUES($1,$2,$3)',[d.rows[0].id,l.product_id,l.quantity]);
  }
  const updated=await client.query("UPDATE sales_orders SET status='DISPATCHED' WHERE id=$1 RETURNING *",[req.params.id]);
  await client.query('COMMIT');res.status(201).json({dispatch:d.rows[0],order:updated.rows[0]});
 }catch(err){await client.query('ROLLBACK');throw err;}finally{client.release();}
}));
router.post('/:id/cancel',allowRoles('ADMIN'),asyncHandler(async(req,res)=>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const o=await client.query('SELECT * FROM sales_orders WHERE id=$1 FOR UPDATE',[req.params.id]);
  if(!o.rowCount) throw new AppError(404,'Sales Order not found');
  if(!['PENDING','CONFIRMED'].includes(o.rows[0].status)) throw new AppError(400,'Only PENDING or CONFIRMED orders can be cancelled');
  if(o.rows[0].status==='CONFIRMED'){
   const lines=await client.query('SELECT product_id,quantity FROM sales_order_items WHERE sales_order_id=$1 ORDER BY product_id',[req.params.id]);
   for(const l of lines.rows){
    const s=await client.query('SELECT reserved_quantity FROM inventory WHERE product_id=$1 FOR UPDATE',[l.product_id]);
    if(!s.rowCount || Number(s.rows[0].reserved_quantity)<Number(l.quantity)) throw new AppError(409,'Cannot release inconsistent reservation');
    await client.query('UPDATE inventory SET reserved_quantity=reserved_quantity-$2,updated_at=NOW() WHERE product_id=$1',[l.product_id,l.quantity]);
   }
  }
  const updated=await client.query("UPDATE sales_orders SET status='CANCELLED' WHERE id=$1 RETURNING *",[req.params.id]);
  await client.query('COMMIT');res.json(updated.rows[0]);
 }catch(err){await client.query('ROLLBACK');throw err;}finally{client.release();}
}));
export default router;
