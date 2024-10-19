import { Hono } from 'hono';
import { handleGenerateInvoice } from '../functions/utils';

type Bindings = {
  RESEND_API_KEY: KVNamespace;
  SUBSCRIPTION_DATA: KVNamespace;
  DB: D1Database;
};

const invoice = new Hono<{ Bindings: Bindings }>();

// get all invoices
invoice.get("/invoices", async (c) => {

  try {
    const res = await c.env.DB.prepare("select * from invoice").all();
	
    const subscriptions = res.results
    return c.json(subscriptions);

  } catch (err: any) {
    console.error(err);

    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }

});


// get single invoice
invoice.get("/invoices/:id", async (c) => {

  try {
    const id = c.req.param('id') 

    const invoice = await c.env.DB.prepare(
      "SELECT * FROM invoice WHERE id = ?"
    )
    .bind(id)
    .first(); 

    if (!invoice) {
      return c.json({ message: 'Invoice not found' }, 404);
    }

    return c.json(invoice);
  } catch (err: any) {

    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// Update a invoice
invoice.put("/invoices/:id", async (c) => {
  const id = c.req.param('id'); 

  try {
    
    const body = await c.req.json(); 
    const fields = Object.keys(body);

    if (fields.length === 0) {
      return c.json({ message: 'No fields provided to update' }, 400);
    }

    // build dynamic fields for sql queries
    const setClause = fields.map((field) => `${field} = ?`).join(", ");

    const query = `UPDATE invoice SET ${setClause} WHERE id = ?`;
    const values = [...fields.map(field => body[field]), id];

    // Prepare and run the SQL query to update the invoice
    const result = await c.env.DB.prepare(query)
    .bind(...values)  
    .run();

    // Check if the update was successful
    if (!result.success) {
      return c.json({ message: 'Invoice not found or no changes made' }, 404);
    }

    // get the updated invoice
    const updatedInvoice = await c.env.DB.prepare(
      "SELECT * FROM invoice WHERE id = ?"
    ).bind(id).first();

    return c.json({ message: 'Invoice updated successfully', invoice: updatedInvoice });

  } catch (err: any) {
    
    console.error(err);  
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// Get list of invoices for a customer
invoice.get("/customer_invoices/:id", async (c) => {
  try {
    const customer_id = c.req.param('id');

    // Fetch all invoices for the given customer ID
    const result = await c.env.DB.prepare(
      "SELECT * FROM invoice WHERE customer_id = ?"
    )
    .bind(customer_id)
    .all();

    // Check if there are any invoices for this customer
    if (!result || result.results.length === 0) {
      return c.json({ message: 'No invoices found for this customer' }, 404);
    }

    // Return the list of invoices
    return c.json(result.results);
  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// Trigger invoice generation via HTTP
invoice.post("/generate_invoice", async (c) => {
  try {
    const { customer_id, subscription_plan_id} = await c.req.json();

    if (!customer_id) {
      return c.json({ error: 'customer_id is required' }, 400);
    }

    // Trigger the invoice generation for the given customer
    const invoice = await handleGenerateInvoice(customer_id, c.env, subscription_plan_id, 'invoice_issue');

    return c.json({
      message: `Invoice generated successfully for customer ${customer_id}`,
      invoice: invoice
    });
  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// Add a new invoice
invoice.post("/invoices", async (c) => {
  try {
    
    const body = await c.req.json(); 
    const { customer_id, amount, due_date, payment_status } = body;

    // Ensure required fields are present
    if (!customer_id || !amount || !due_date || !payment_status) {
      return c.json({ message: 'Missing required fields' }, 400);
    }

    // Prepare and run the SQL query to insert the invoice
    const res = await c.env.DB.prepare(
      "INSERT INTO invoice (customer_id, amount, due_date, payment_status) VALUES (?, ?, ?, ?)"
    )
    .bind(customer_id, amount, due_date, payment_status)
    .run();

    // Check if the res was successful
    if (!res.success) {
      return c.json({ message: 'Failed to add invoice' }, 500);
    }

    // Get the added invoice
    const lastInsertId = res.meta?.last_row_id;

    const newInvoice = await c.env.DB.prepare(
      "SELECT * FROM invoice WHERE id = ?"
    ).bind(lastInsertId).first();

    return c.json({ message: 'Invoice added successfully', invoice: newInvoice });

  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});



export default invoice;