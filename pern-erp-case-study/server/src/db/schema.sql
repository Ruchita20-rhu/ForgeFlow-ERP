CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'SALES')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(180) NOT NULL,
  contact_person VARCHAR(120) NOT NULL,
  mobile VARCHAR(30) NOT NULL,
  email VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  product_code VARCHAR(40) NOT NULL UNIQUE,
  product_name VARCHAR(180) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  base_price NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  product_id INTEGER PRIMARY KEY REFERENCES products(id),
  physical_quantity INTEGER NOT NULL DEFAULT 0 CHECK (physical_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0 AND reserved_quantity <= physical_quantity),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enquiries (
  id SERIAL PRIMARY KEY,
  enquiry_number VARCHAR(40) NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  enquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','QUOTED','WON','LOST')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (required_date IS NULL OR required_date >= enquiry_date)
);

CREATE TABLE IF NOT EXISTS enquiry_items (
  id SERIAL PRIMARY KEY,
  enquiry_id INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE(enquiry_id, product_id)
);

CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  quotation_number VARCHAR(40) NOT NULL UNIQUE,
  enquiry_id INTEGER NOT NULL UNIQUE REFERENCES enquiries(id),
  valid_until DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','ACCEPTED','REJECTED')),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  gst_percent NUMERIC(5,2) NOT NULL DEFAULT 18 CHECK (gst_percent BETWEEN 0 AND 100),
  base_amount NUMERIC(14,2) NOT NULL CHECK (base_amount >= 0),
  discount_amount NUMERIC(14,2) NOT NULL CHECK (discount_amount >= 0),
  tax_amount NUMERIC(14,2) NOT NULL CHECK (tax_amount >= 0),
  line_amount NUMERIC(14,2) NOT NULL CHECK (line_amount >= 0)
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  quotation_id INTEGER NOT NULL UNIQUE REFERENCES quotations(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','DISPATCHED','CANCELLED')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id SERIAL PRIMARY KEY,
  sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  UNIQUE(sales_order_id, product_id)
);

CREATE TABLE IF NOT EXISTS dispatches (
  id SERIAL PRIMARY KEY,
  dispatch_number VARCHAR(40) NOT NULL UNIQUE,
  sales_order_id INTEGER NOT NULL UNIQUE REFERENCES sales_orders(id),
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_number VARCHAR(40) NOT NULL,
  driver_name VARCHAR(120) NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispatch_items (
  id SERIAL PRIMARY KEY,
  dispatch_id INTEGER NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE(dispatch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_enquiries_customer ON enquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_enquiry ON quotations(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON sales_orders(status);
