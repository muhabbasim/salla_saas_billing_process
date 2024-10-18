
-- Insert sample customer data
INSERT INTO customer (name, email, subscription_plan_id, subscription_status, next_billing_date) VALUES
('Alice Johnson', 'alice@example.com', 1, 'active', '2024-11-01'),
('Bob Smith', 'bob@example.com', 2, 'active', '2024-11-05'),
('Charlie Brown', 'charlie@example.com', 3, 'cancelled', NULL),
('Dana White', 'mjnoonha90@gmail.com', 1, 'active', '2024-10-17');

-- Insert sample subscription plan data
INSERT INTO subscription_plan (name, billing_cycle, price, status) VALUES
('Basic Plan', 'monthly', 10.00, 'active'),
('Pro Plan', 'monthly', 25.00, 'active'),
('Enterprise Plan', 'yearly', 250.00, 'active'),
('Premium Plan', 'yearly', 100.00, 'inactive');


-- Insert sample invoice data
INSERT INTO invoice (customer_id, amount, due_date, payment_status, payment_date) VALUES
(1, 10.00, '2024-11-01', 'pending', NULL),
(2, 25.00, '2024-11-05', 'paid', '2024-11-05'),
(3, 250.00, '2025-01-01', 'pending', NULL),
(1, 10.00, '2024-10-01', 'paid', '2024-10-01');


-- Insert sample payment data
INSERT INTO payment (invoice_id, amount, payment_method, payment_date) VALUES
(2, 25.00, 'credit card', '2024-11-05'),
(4, 10.00, 'paypal', '2024-10-01');