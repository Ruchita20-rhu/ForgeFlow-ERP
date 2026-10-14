import bcrypt from 'bcryptjs';
export async function seed(db) {
  const adminHash = await bcrypt.hash('Admin123!', 10);
  const salesHash = await bcrypt.hash('Sales123!', 10);
  await db.query(
    `INSERT INTO users(name,email,password_hash,role) VALUES
     ('System Admin','admin@forgeflow.local',$1,'ADMIN'),
     ('Sales Executive','sales@forgeflow.local',$2,'SALES')
     ON CONFLICT(email) DO NOTHING`, [adminHash, salesHash]
  );
  const products = [
    ['IP-100','Industrial Bearing 6205','Mechanical','pcs',450,500],
    ['IP-110','Hydraulic Pump 2HP','Hydraulics','pcs',12500,45],
    ['IP-120','Steel Coupling 50mm','Mechanical','pcs',780,300],
    ['IP-130','Industrial Valve DN25','Pneumatics','pcs',1850,120],
    ['IP-140','Conveyor Roller 600mm','Material Handling','pcs',2400,90],
    ['IP-150','Pressure Gauge 0-10bar','Instrumentation','pcs',950,160],
    ['IP-160','Drive Belt B-Section','Power Transmission','pcs',320,400],
    ['IP-170','Pneumatic Cylinder 32mm','Pneumatics','pcs',3200,70]
  ];
  for (const [code,name,category,unit,price,qty] of products) {
    const p = await db.query(
      `INSERT INTO products(product_code,product_name,category,unit,base_price)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(product_code) DO UPDATE SET product_name=EXCLUDED.product_name
       RETURNING id`, [code,name,category,unit,price]
    );
    await db.query(
      `INSERT INTO inventory(product_id,physical_quantity,reserved_quantity) VALUES($1,$2,0)
       ON CONFLICT(product_id) DO NOTHING`, [p.rows[0].id,qty]
    );
  }
}
