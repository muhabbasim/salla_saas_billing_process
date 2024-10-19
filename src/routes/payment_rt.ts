import { Hono } from 'hono';
import { handleProcessPayment } from '../functions/utils';

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


// Process payment for an invoice
payment.post("/process_payment", async (c) => {
  try {
    const { invoice_id, amount, payment_method } = await c.req.json();

    // Fetch the invoice details
    const invoice = await c.env.DB.prepare(
      "SELECT * FROM invoice WHERE id = ?"
    )
    .bind(invoice_id)
    .first();

    // Check if invoice exists
    if (!invoice) {
      return c.json({ message: 'Invoice not found' }, 404);
    }

    // Check if the invoice is already paid
    if (invoice.payment_status === 'paid') {
      return c.json({ message: 'Invoice already paid' }, 400);
    }


    // Fetch the customer to get the subscription_plan_id
    const customer = await c.env.DB.prepare(
      "SELECT subscription_plan_id FROM customer WHERE id = ?"
    )
    .bind(invoice.customer_id)
    .first();

    if (!customer) {
      return c.json({ message: 'Customer not found' }, 404);
    }

    // Fetch subscription details based on the subscription_plan_id
    const subscriptionPlan = await c.env.DB.prepare(
      "SELECT billing_cycle FROM subscription_plan WHERE id = ?"
    )
    .bind(customer.subscription_plan_id)
    .first();

    console.log(subscriptionPlan)

    if (!subscriptionPlan) {
      return c.json({ message: 'Subscription plan not found' }, 404);
    }

    // Now that we have the billing cycle, pass it to the processPayment function
    const billingCycle: any = subscriptionPlan.billing_cycle;


    // Simulate or process the payment (replace with actual payment provider logic)
    const paymentSuccess = await handleProcessPayment(c.env, invoice_id, amount, payment_method, billingCycle);

    // If payment is successful, update the invoice to 'paid'
    if (paymentSuccess) {
      await c.env.DB.prepare(
        "UPDATE invoice SET payment_status = 'paid', payment_date = ? WHERE id = ?"
      )
      .bind(new Date().toISOString().split('T')[0], invoice_id)
      .run();

      return c.json({
        message: 'Payment successful',
        invoice_id: invoice_id,
        amount_paid: amount,
        payment_method: payment_method
      });
    } else {
      return c.json({
        message: 'Payment failed',
        invoice_id: invoice_id,
        amount_due: invoice.amount
      }, 400);
    }
  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});



export default payment;