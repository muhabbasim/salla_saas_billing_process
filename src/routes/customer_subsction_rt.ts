import { Hono } from 'hono';
import { calculateNextBillingDate, getSubscriptionPlan, handleGenerateInvoice, handleProcessPayment, handleProratedBilling } from '../functions/utils';

type Bindings = {
  RESEND_API_KEY: KVNamespace;
  SUBSCRIPTION_DATA: KVNamespace;
  DB: D1Database;
};

const cus_subscription = new Hono<{ Bindings: Bindings }>();

cus_subscription.post("/create", async (c) => {

  try {
    const body = await c.req.json(); 
    const { name, email, subscription_plan_id, payment_method } = body;

    // Check if the customer exists
    const existingCustomer = await c.env.DB.prepare(
      "SELECT * FROM customer WHERE email = ?"
    ).bind(email).first();

    if (existingCustomer) {

      if (existingCustomer.subscription_status === 'active') {
        // If the customer has an active subscription, return a message
        return c.json({
          error: true,
          message: `Customer with email ${email} already has an active subscription.`
        }, 400);

      } else {
        // If the subscription is not active, proceed with sending an invoice and updating the subscription
        console.log(`Customer with email ${email} found with non-active subscription. Proceeding...`);

        // Generate the invoice for the existing customer with a non-active subscription
        const subscriptionPlan = await getSubscriptionPlan(subscription_plan_id, c.env);

        if (!subscriptionPlan) {
          throw new Error('Subscription plan not found or inactive.');
        }

        const invoiceResult = await handleGenerateInvoice(
          Number(existingCustomer.id), 
          c.env, 
          subscription_plan_id,
          "invoice_issue"
        );

        const invoiceId = invoiceResult.invoiceId;

        if (!invoiceId) {
          throw new Error('Failed to generate invoice.');
        }

        // Process the payment for the invoice
        await handleProcessPayment(
          c.env, 
          invoiceId, 
          subscriptionPlan.price, 
          payment_method, 
          subscriptionPlan.billing_cycle
        );

        // Fetch invoice and payment details
        const invoiceDetails = await c.env.DB.prepare(
          "SELECT * FROM invoice WHERE id = ?"
        ).bind(invoiceId).first();

        const paymentDetails = await c.env.DB.prepare(
          "SELECT * FROM payment WHERE invoice_id = ?"
        ).bind(invoiceId).first();

        return c.json({
          message: `Invoice generated and payment processed for existing customer ${existingCustomer.id}.`,
          "subscription plan": subscriptionPlan, 
          "invoice": invoiceDetails, 
          "payment": paymentDetails,  
        });
      }

    } else {
      // If the customer does not exist, create a new customer and proceed
      const subscriptionPlan = await getSubscriptionPlan(subscription_plan_id, c.env);

      if (!subscriptionPlan) {
        throw new Error('Subscription plan not found or inactive.');
      }

      // get customer information
      const customer = await c.env.DB.prepare(
        "INSERT INTO customer (name, email, subscription_plan_id, subscription_status) VALUES (?, ?, ?, ?)"
      ).bind(name, email, subscription_plan_id, 'cancelled').run();
    
      const customerId = customer.meta.last_row_id;

      if (!customerId) {
        throw new Error('Failed to create new customer.');
      }

  
      // Use Cloudflare Workers KV to save customer information in Cloudflare
      await c.env.SUBSCRIPTION_DATA.put("subscription_data", JSON.stringify(customerId))

      // handle invoice
      const invoiceResult = await handleGenerateInvoice(
        customerId, 
        c.env, 
        subscription_plan_id,
        "payment_invoice"
      );

      const invoiceId = invoiceResult.invoiceId;

      if (!invoiceId) {
        throw new Error('Failed to generate invoice.');
      }

      // handle payment process
      await handleProcessPayment(
        c.env, 
        invoiceId, 
        subscriptionPlan.price, 
        payment_method, 
        subscriptionPlan.billing_cycle
      );

      // const invoiceDetails = await c.env.DB.prepare(
      //   "SELECT * FROM invoice WHERE id = ?"
      // ).bind(invoiceId).first();

      // const paymentDetails = await c.env.DB.prepare(
      //   "SELECT * FROM payment WHERE invoice_id = ?"
      // ).bind(invoiceId).first();

      return c.json({
        message: `New subscription created for customer ${customerId} with invoice ${invoiceId} and payment processed.`,
        "subscription plan": subscriptionPlan, 
        // "invoice": invoiceDetails, 
        // "payment": paymentDetails,  
      });
    }

  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// create a subscription for customer
cus_subscription.put("/update", async (c) => {

  try {
    
    const body = await c.req.json(); 
    const { id, new_subscription_plan } = body;

    const customerId = id;

    const newSubscriptionPlan = await c.env.DB.prepare(
      "SELECT billing_cycle, price FROM subscription_plan WHERE id = ?"
    ).bind(new_subscription_plan).first();

    const proratedBill = await handleProratedBilling(c.env, customerId, new_subscription_plan)
    return c.json({newSubscriptionPlan, proratedBill})
    
  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// Assign a subscription plan to a customer
cus_subscription.post("/assign", async (c) => {
  try {
    const { customer_id, subscription_plan_id } = await c.req.json();

    // Fetch the customer details
    const customer = await c.env.DB.prepare(
      "SELECT * FROM customer WHERE id = ?"
    )
    .bind(customer_id)
    .first();

    // Check if customer exists
    if (!customer) {
      return c.json({ message: 'Customer not found' }, 404);
    }

    // Fetch the subscription plan details
    const subscriptionPlan = await c.env.DB.prepare(
      "SELECT * FROM subscription_plan WHERE id = ? AND status = 'active'"
    )
    .bind(subscription_plan_id)
    .first();

    // Check if subscription plan exists and is active
    if (!subscriptionPlan) {
      return c.json({ message: 'Subscription plan not found or inactive' }, 404);
    }

    const billing_cycle: any = subscriptionPlan.billing_cycle
    // Calculate the next billing date based on the billing cycle
    const nextBillingDate = calculateNextBillingDate(billing_cycle);

    // Assign the subscription plan to the customer and update the next billing date
    await c.env.DB.prepare(
      "UPDATE customer SET subscription_plan_id = ?, subscription_status = 'active', next_billing_date = ? WHERE id = ?"
    )
    .bind(subscription_plan_id, nextBillingDate, customer_id)
    .run();

    return c.json({
      message: 'Subscription plan assigned successfully',
      customer_id: customer_id,
      subscription_plan_id: subscription_plan_id,
      next_billing_date: nextBillingDate
    });
  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});



export default cus_subscription;

