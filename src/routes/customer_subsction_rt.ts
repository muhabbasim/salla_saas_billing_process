import { Hono } from 'hono';
import { getSubscriptionPlan, handleGenerateInvoice, handleProcessPayment, handleProratedBilling } from '../functions/utils';

export type Bindings = {
  RESEND_API_KEY: KVNamespace;
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
          existingCustomer.id, 
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

      const customer = await c.env.DB.prepare(
        "INSERT INTO customer (name, email, subscription_plan_id, subscription_status) VALUES (?, ?, ?, ?)"
      ).bind(name, email, subscription_plan_id, 'cancelled').run();
    
      const customerId = customer.meta.last_row_id;
      if (!customerId) {
        throw new Error('Failed to create new customer.');
      }

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

      await handleProcessPayment(
        c.env, 
        invoiceId, 
        subscriptionPlan.price, 
        payment_method, 
        subscriptionPlan.billing_cycle
      );

      const invoiceDetails = await c.env.DB.prepare(
        "SELECT * FROM invoice WHERE id = ?"
      ).bind(invoiceId).first();

      const paymentDetails = await c.env.DB.prepare(
        "SELECT * FROM payment WHERE invoice_id = ?"
      ).bind(invoiceId).first();

      return c.json({
        message: `New subscription created for customer ${customerId} with invoice ${invoiceId} and payment processed.`,
        "subscription plan": subscriptionPlan, 
        "invoice": invoiceDetails, 
        "payment": paymentDetails,  
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
    const { id, newSubscriptionPlanId } = body;

    const customerId = id;

    const newSubscriptionPlan = await c.env.DB.prepare(
      "SELECT billing_cycle, price FROM subscription_plan WHERE id = ?"
    ).bind(newSubscriptionPlanId).first();

    const proratedBill = await handleProratedBilling(c.env, customerId, newSubscriptionPlanId)
    return c.json({newSubscriptionPlan, proratedBill})
    
  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});

export default cus_subscription;




// // create a subscription for customer
// cus_subscription.post("/create", async (c) => {

//   try {
 
//     const body = await c.req.json(); 
//     const { name, email, subscription_plan_id, payment_method } = body;
    
//     // Check if the customer already has an active subscription
//     const existingCustomer = await c.env.DB.prepare(
//       "SELECT * FROM customer WHERE email = ? AND subscription_status = 'active'"
//     ).bind(email).first();

//     if (existingCustomer) {
//       // If an active subscription exists, return an error
//       return c.json({
//         error: true,
//         message: `Customer with email ${email} already has an active subscription.`
//       }, 400);
//     }
    
//     const subscriptionPlan = await getSubscriptionPlan(subscription_plan_id, c.env)
    
//     if (!subscriptionPlan) {
//       throw new Error('Subscription plan not found or inactive.');
//     }

//     // Insert the new customer into the customer table
//     const customer = await c.env.DB.prepare(
//       "INSERT INTO customer (name, email, subscription_plan_id, subscription_status) VALUES (?, ?, ?, ?)"
//     ).bind(name, email, subscription_plan_id, 'cancelled').run();
  
//     // Get the newly created customer ID
//     const customerId = customer.meta.last_row_id;
//     if (!customerId) {
//       throw new Error('Failed to create new customer.');
//     }
    
//     // Generate the initial invoice for the new subscription
//     const invoiceResult = await generateInvoice(
//       customerId, 
//       c.env, 
//       subscription_plan_id,
//       "invoice_issue"
//     )

//     // Get the newly created invoice ID
//     const invoiceId = invoiceResult.meta.last_row_id;

//     if (!invoiceId) {
//       throw new Error('Failed to generate invoice.');
//     }

//     // Process the payment for the invoice (assuming the payment is successful)
//     await processPayment(
//       c.env, 
//       invoiceId, 
//       subscriptionPlan.price, 
//       payment_method, 
//       subscriptionPlan.billing_cycle
//     );

//     // Fetch the full invoice details
//     const invoiceDetails = await c.env.DB.prepare(
//       "SELECT * FROM invoice WHERE id = ?"
//     ).bind(invoiceId).first();

//     // Fetch the full payment details 
//     const paymentDetails = await c.env.DB.prepare(
//       "SELECT * FROM payment WHERE invoice_id = ?"
//     ).bind(invoiceId).first();

//     return c.json({
//       "message": `New subscription created for customer ${customerId} with invoice ${invoiceId} and payment processed.`,
//       "subscription plan": subscriptionPlan, 
//       "invoice": invoiceDetails, 
//       "payment": paymentDetails,  
//     });

//   } catch (err: any) {
//     console.error(err);
//     return c.json({
//       error: true,
//       message: err.message || 'Internal Server Error'
//     }, 500);
//   }
// });