CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  avatar text,
  role text NOT NULL CHECK (role IN ('customer', 'staff', 'admin')),
  active boolean NOT NULL DEFAULT true,
  session_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text;

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  stock integer NOT NULL CHECK (stock >= 0),
  image text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vouchers (
  code text PRIMARY KEY,
  percent integer NOT NULL CHECK (percent BETWEEN 1 AND 100),
  minimum_cents integer NOT NULL CHECK (minimum_cents >= 0),
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  request_id uuid NOT NULL,
  items jsonb NOT NULL,
  subtotal_cents integer NOT NULL CHECK (subtotal_cents > 0),
  delivery_cents integer NOT NULL CHECK (delivery_cents >= 0),
  discount_cents integer NOT NULL CHECK (discount_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents = subtotal_cents + delivery_cents - discount_cents),
  voucher_code text REFERENCES vouchers(code),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_method text NOT NULL,
  payment_status text NOT NULL,
  wallet_provider text,
  shipping_address text NOT NULL,
  shipping_region text,
  shipping_province text,
  shipping_city text,
  phone text NOT NULL,
  postal_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);

-- Keep postal codes from older orders while allowing new orders to omit them.
ALTER TABLE orders ALTER COLUMN postal_code DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS wallet_provider text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_region text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_province text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city text;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_wallet_provider_check;
UPDATE orders SET payment_status='recorded' WHERE payment_status='simulated';
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash_on_delivery', 'credit_card', 'e_wallet', 'demo_wallet'));
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'recorded', 'received', 'voided'));
ALTER TABLE orders ADD CONSTRAINT orders_wallet_provider_check CHECK (
  (payment_method = 'e_wallet' AND wallet_provider IS NOT NULL AND wallet_provider IN ('gcash', 'maya')) OR
  (payment_method <> 'e_wallet' AND wallet_provider IS NULL)
);

CREATE TABLE IF NOT EXISTS order_events (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  product_id uuid NOT NULL REFERENCES products(id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, order_id, product_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_customer_date ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_events_order_date ON order_events (order_id, created_at);
CREATE INDEX IF NOT EXISTS reviews_product_date ON reviews (product_id, created_at DESC);
