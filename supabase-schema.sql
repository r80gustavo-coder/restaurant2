-- Create tables
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT
);

CREATE TABLE inventory_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  "currentStock" REAL DEFAULT 0,
  "minStock" REAL DEFAULT 0
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  "categoryId" INTEGER REFERENCES categories(id),
  image TEXT,
  type TEXT DEFAULT 'composed', -- 'fixed' or 'composed'
  "inventoryItemId" INTEGER REFERENCES inventory_items(id)
);

CREATE TABLE product_ingredients (
  id SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL REFERENCES products(id),
  "inventoryItemId" INTEGER NOT NULL REFERENCES inventory_items(id),
  quantity REAL NOT NULL
);

CREATE TABLE tables (
  id SERIAL PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  "loginCode" TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'livre'
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  "tableId" INTEGER NOT NULL REFERENCES tables(id),
  status TEXT NOT NULL,
  "paymentStatus" TEXT DEFAULT 'pending',
  "paymentMethod" TEXT,
  total REAL NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL REFERENCES orders(id),
  "productId" INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  notes TEXT
);

-- Insert initial data
INSERT INTO categories (name, icon) VALUES 
('Lanches', 'burger'),
('Pizzas', 'pizza'),
('Bebidas', 'cup-soda');

INSERT INTO inventory_items (name, unit, "currentStock", "minStock") VALUES 
('Pão de Hambúrguer', 'un', 100, 20),
('Carne 150g', 'un', 100, 20),
('Queijo Mussarela', 'fatia', 200, 50),
('Alface', 'fatia', 200, 50),
('Tomate', 'fatia', 200, 50),
('Coca-Cola Lata 350ml', 'un', 50, 10);

INSERT INTO products (name, description, price, "categoryId", image, type, "inventoryItemId") VALUES 
('X-Burger', 'Delicioso hambúrguer artesanal', 25.90, 1, 'https://picsum.photos/seed/burger/400/300', 'composed', null),
('Coca-Cola Lata', 'Refrigerante 350ml', 5.50, 3, 'https://picsum.photos/seed/coke/400/300', 'fixed', 6);

INSERT INTO product_ingredients ("productId", "inventoryItemId", quantity) VALUES 
(1, 1, 1),
(1, 2, 1),
(1, 3, 2),
(1, 4, 1),
(1, 5, 1);

INSERT INTO tables (number, "loginCode", status) VALUES 
(1, 'MESA01', 'livre'),
(2, 'MESA02', 'livre'),
(3, 'MESA03', 'livre');
