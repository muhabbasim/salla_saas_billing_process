import { Hono } from 'hono';

type Bindings = {
  CASH: KVNamespace;
  DB: D1Database;
};

const payment = new Hono<{ Bindings: Bindings }>();

// Get all payments
payment.get("/payments", async (c) => {
  try {

    const res = await c.env.DB.prepare("SELECT * FROM payment").all();
    return c.json(res.results);

  } catch (err: any) {

    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// Get a single payment by ID
payment.get("/payments/:id", async (c) => {
  
  const id = c.req.param('id'); 

  try {
    const payment = await c.env.DB.prepare("SELECT * FROM payment WHERE id = ?")
    .bind(id)
    .first();

    if (!payment) {
      return c.json({ message: 'Payment not found' }, 404);
    }

    return c.json(payment);

  } catch (err: any) {
    
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// Add a new payment
payment.post("/payments", async (c) => {

  try {
    
    const body = await c.req.json();
    const { invoice_id, amount, payment_method, payment_date } = body;
    
    // Ensure required fields are added
    if (!invoice_id || !amount || !payment_method || !payment_date) {
      return c.json({ message: 'Missing required fields' }, 400);
    }

    // Prepare and run the SQL query to insert the payment
    const res = await c.env.DB.prepare(
      "INSERT INTO payment (invoice_id, amount, payment_method, payment_date) VALUES (?, ?, ?, ?)"
    )
    .bind(invoice_id, amount, payment_method, payment_date)
    .run();

    // Check if the payment was successfully
    if (!res.success) {
      return c.json({ message: 'Failed to add payment' }, 500);
    }

    // Get the last added payment row's ID
    const lastInsertId = res.meta?.last_row_id;

    const newPayment = await c.env.DB.prepare(
      "SELECT * FROM payment WHERE id = ?"
    ).bind(lastInsertId).first();

    return c.json({ message: 'Payment added successfully', payment: newPayment });

  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// Update a payment
payment.put("/payments/:id", async (c) => {
  const id = c.req.param('id'); 

  try {
    
    const body = await c.req.json(); 
    const fields = Object.keys(body);

    if (fields.length === 0) {
      return c.json({ message: 'No fields provided to update' }, 400);
    }

    // update the payment fields dynamically
    const setClause = fields.map((field) => `${field} = ?`).join(", ");

    // create sql query
    const query = `UPDATE payment SET ${setClause} WHERE id = ?`;
    const values = [...fields.map(field => body[field]), id];


    const result = await c.env.DB.prepare(query)
    .bind(...values)  
    .run();

    // Check if the update was successful
    if (!result.success) {
      return c.json({ message: 'Payment not found or no changes made' }, 404);
    }

    const updatedPayment = await c.env.DB.prepare(
      "SELECT * FROM payment WHERE id = ?"
    ).bind(id).first();

    return c.json({ message: 'Payment updated successfully', payment: updatedPayment });

  } catch (err: any) {
    
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


export default payment;