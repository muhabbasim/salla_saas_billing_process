-- Migration number: 0001 	 2024-10-17T12:18:13.090Z
-- Migration number: 0001 	 2024-10-15T12:09:54.509Z

-- Customer table
--   id: Unique identifier for the customer.
-- ○ name: Customer's name.
-- ○ email: Customer's email address.
-- ○ subscription_plan_id: The current subscription plan the customer is on.
-- ○ subscription_status: Current status of the subscription (e.g., active, cancelled).

DROP table If EXISTS customer;
CREATE TABLE customer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subscription_plan_id INTEGER,
  subscription_status VARCHAR(50) CHECK (subscription_status IN ('active', 'inactive', 'cancelled')),
  next_billing_date DATE,
  FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plan(id)
);

DROP TABLE IF EXISTS subscription_plan;
CREATE TABLE subscription_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  billing_cycle VARCHAR(50) CHECK (billing_cycle IN ('monthly', 'yearly')) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) CHECK (status IN ('active', 'inactive')) NOT NULL
);

DROP TABLE IF EXISTS invoice;
CREATE TABLE invoice (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  payment_status VARCHAR(50) CHECK (payment_status IN ('pending', 'paid', 'failed')) NOT NULL,
  payment_date DATE,
  FOREIGN KEY (customer_id) REFERENCES customer(id)
);

DROP TABLE IF EXISTS payment;
CREATE TABLE payment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) CHECK (payment_method IN ('credit card', 'paypal', 'bank transfer')) NOT NULL,
  payment_date DATE NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoice(id)
);