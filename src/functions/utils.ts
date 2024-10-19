import { HandleSendEmails } from "./email";

export type contentProps = {
  emailTo: any, 
  emailConent: string, 
  subject: string
}

type Bindings = {
  RESEND_API_KEY: KVNamespace;
  SUBSCRIPTION_DATA: KVNamespace;
  DB: D1Database;
};

// Helper function to calculate the next billing date
export function calculateNextBillingDate(billingCycle: any) {

  const currentDate = new Date();

  if (billingCycle === 'monthly') {
    currentDate.setMonth(currentDate.getMonth() + 1); // Add one month
  } else if (billingCycle === 'yearly') {
    currentDate.setFullYear(currentDate.getFullYear() + 1); // Add one year
  }

  return currentDate.toISOString().split('T')[0]; // Return the new next billing date in YYYY-MM-DD format
}

// get customer subscription_plan  function 
export async function getSubscriptionPlan(subscription_plan_id: string, env: any) {
  try {
    
    const res = await env.DB.prepare(
      "SELECT * FROM subscription_plan WHERE id = ?"
    ).bind(subscription_plan_id).first();

    // Log the result to debug

    if (!res) {
      // If no result is found, log and return an appropriate message
      console.log(`No subscription plan found for id: ${subscription_plan_id}`);
      return {
        error: true,
        message: `No subscription plan found for id: ${subscription_plan_id}`
      };
    }

    // Return the subscription plan details
    return res;

  } catch (err: any) {
    console.error(err);
    // Return an error object, which can be handled in the route
    return {
      error: true,
      message: err.message || 'Internal Server Error'
    };
  }
}

// handle prorate billings
export async function handleProratedBilling(env: any, customerId: number, newSubscriptionPlanId: string) {
  try {
    
    // Get the current subscription and billing info for the customer
    const customer = await env.DB.prepare(
      `SELECT c.subscription_plan_id, c.subscription_status, c.next_billing_date, s.billing_cycle, s.price 
       FROM customer c 
       JOIN subscription_plan s ON c.subscription_plan_id = s.id 
       WHERE c.id = ?`
    ).bind(customerId).first();

    if (!customer) {
      throw new Error(`Customer with id ${customerId} not found.`);
    }

    // Check if the customer's subscription is active
    if (customer.subscription_status !== 'active') {
      return {
        error: true,
        message: `Customer with id ${customerId} does not have an active subscription.`
      };
    }

    const currentBillingCycle = customer.billing_cycle;
    const currentPrice = customer.price;
    const nextBillingDate = new Date(customer.next_billing_date);

    // Get details of the new subscription plan
    const newSubscriptionPlan = await env.DB.prepare(
      "SELECT billing_cycle, price FROM subscription_plan WHERE id = ?"
    ).bind(newSubscriptionPlanId).first();

    if (!newSubscriptionPlan) {
      throw new Error(`New subscription plan with id ${newSubscriptionPlanId} not found.`);
    }

    const newPrice = newSubscriptionPlan.price;

    // Calculate how many days are left and how many days have been used
    const today = new Date();
    const totalDaysInCycle = currentBillingCycle === 'monthly' ? 30 : 365;

    // Calculate the start date of the current cycle
    const cycleStartDate = new Date(nextBillingDate);
    cycleStartDate.setDate(cycleStartDate.getDate() - totalDaysInCycle);

    // Calculate days used and days remaining
    const daysUsed = Math.floor((today.getTime() - cycleStartDate.getTime()) / (1000 * 3600 * 24));
    const daysRemaining = totalDaysInCycle - daysUsed;

    // Step 4: Calculate prorated amounts
    const proratedCurrentPlanAmount = (currentPrice / totalDaysInCycle) * daysUsed;
    const proratedNewPlanAmount = (newPrice / totalDaysInCycle) * daysRemaining;

    const totalAmount = proratedNewPlanAmount - proratedCurrentPlanAmount;

    // issue a notification for billing
    await ProratedBillingInvoice(customerId, env, newSubscriptionPlanId, Math.floor(totalAmount), 'invoice_issue')
  

    return { 
      totalAmount: totalAmount, 
      daysUsed: daysUsed, 
      daysRemaining: daysRemaining, 
      totalDaysInCycle: totalDaysInCycle, 
      message: totalAmount > 0 ? 
      `Prorated billing handled for customer ${customerId} & needs to pay an additional ${totalAmount} for the upgrade.` :
      `Prorated billing handled for customer ${customerId} & to be refunede ${totalAmount} for donwgrade.`
    };

  } catch (err: any) {
    console.error(err);
    return {
      error: true,
      message: err.message || 'Internal Server Error'
    };
  }
}

// Function to process payment for the invoice
export async function handleProcessPayment(env: any, invoiceId: number, amount: any, paymentMethod: string, billing_cycle: string) {
  try {
    const paymentDate = new Date().toISOString().split('T')[0]; // Payment today
    const nextBillingDate = calculateNextBillingDate(billing_cycle);
  
    // Simulate payment success or failure (this could be an API call to a payment provider)
    const paymentIsSuccessful = true; // Assume this is dynamically determined

    // Query to get the subscription plan using the invoiceId
    const invoice = await env.DB.prepare(
    `SELECT i.*, c.subscription_plan_id
      FROM invoice i
      JOIN customer c ON i.customer_id = c.id
      WHERE i.id = ?`
    ).bind(invoiceId).first();

    if (!paymentIsSuccessful) {
      // If payment fails, trigger the 'payment_failure' event

      if (!invoice) {
        throw new Error(`Invoice with id ${invoiceId} not found.`);
      }

      const customerId = invoice.customer_id;

      // Update the invoice status to 'failed'
      await env.DB.prepare(
        "UPDATE invoice SET payment_status = 'failed' WHERE id = ?"
      ).bind(invoiceId).run();
      
      // Trigger payment failure email
      await handleGenerateInvoice(customerId, env, invoice.subscription_plan_id, "payment_failure");
      console.log(invoice)
      console.log(`Payment failed for invoice ${invoiceId} with method ${paymentMethod}.`);
      return {
        success: false,
        message: "Payment failed",
      };
    }

    // Insert the payment into the payment table
    const payment = await env.DB.prepare(
      "INSERT INTO payment (invoice_id, amount, payment_method, payment_date) VALUES (?, ?, ?, ?)"
    ).bind(invoiceId, amount, paymentMethod, paymentDate).run();
  
    // Mark the invoice as 'paid'
    await env.DB.prepare(
      "UPDATE invoice SET payment_status = 'paid', payment_date = ? WHERE id = ?"
    ).bind(paymentDate, invoiceId).run();
  

    if (!invoice) {
      throw new Error(`Invoice with id ${invoiceId} not found.`);
    }
    
    const customerId = invoice.customer_id;
    
    // Update customer subscription plan and set the next billing date
    await env.DB.prepare(
      "UPDATE customer SET subscription_status = 'active', next_billing_date = ? WHERE id = ?"
    ).bind(nextBillingDate, customerId).run();

    // Trigger payment success email
    await handleGenerateInvoice(customerId, env, invoice.subscription_plan_id, "payment_success");

    console.log(`Payment processed for invoice ${invoiceId} with method ${paymentMethod}.`);
    return {
      success: true,
      message: "Payment successful",
      payment: payment.results,
    };
    
  } catch (err: any) {
    console.error(err);
    return {
      error: true,
      message: err.message || 'Internal Server Error',
    };
  }
}

// generate invoice function 
export async function ProratedBillingInvoice(customerId: number, env: Bindings, subscription_plan_id: string, amount: number, eventType: string) {
  try {
    // check the subscription plan
    const subscriptionPlan = await getSubscriptionPlan(subscription_plan_id, env);
    
    if (!subscriptionPlan) {
      throw new Error("Subscription plan not found.");
    }

    // Get customer information
    const customer = await env.DB.prepare(
      "SELECT email FROM customer WHERE id = ?"
    ).bind(customerId).first();

    if (!customer || !customer.email) {
      throw new Error("Customer not found or email is missing.");
    }

    const today = new Date().toISOString().split('T')[0]; // Get the current date

    // Insert a new invoice if eventType is 'invoice_issue'
    let invoiceId = null;
    if (eventType === 'invoice_issue') {
      const invoice = await env.DB.prepare(
        "INSERT INTO invoice (customer_id, amount, due_date, payment_status) VALUES (?, ?, ?, ?)"
      ).bind(customerId, amount, today, 'pending').run();

      invoiceId = invoice.meta.last_row_id;
      if (!invoiceId) {
        throw new Error("Failed to create an invoice.");
      }
    }

    // Determine the email content based on eventType
    let emailContent = '';

    switch (eventType) {
      case 'invoice_issue':
        emailContent = `
          <p>Dear ${customer.email},</p>
          <p>Your subscription billing has been issued.</p>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Due Date:</strong> ${today}</p>
          <p><strong>Status:</strong> Pending</p>
        `;
        break;
      
      case 'payment_success':
        emailContent = `
          <p>Dear ${customer.email},</p>
          <p>Your payment has been successfully processed.</p>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Payment Date:</strong> ${today}</p>
          <p><strong>Status:</strong> Paid</p>
        `;
        break;
      
      case 'payment_failure':
        emailContent = `
          <p>Dear ${customer.email},</p>
          <p>Unfortunately, your payment failed.</p>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Attempted Payment Date:</strong> ${today}</p>
          <p>Please try again or contact support if you need assistance.</p>
        `;
        break;

      default:
        throw new Error("Invalid event type.");
    }


    // Prepare the email content
    const emailData = {
      emailTo: customer.email,
      emailConent: emailContent,
      subject: eventType === 'invoice_issue' ? 'Invoice Issued' :
               eventType === 'payment_success' ? 'Payment Success' :
               'Payment Failure',
    };


    console.log(emailContent);
    console.log(emailData)
    
    // Send the email
    await HandleSendEmails(env, emailData);

    return {
      success: true,
      invoiceId: invoiceId,
      message: `Event ${eventType} handled successfully.`,
    };

  } catch (err: any) {
    console.error(err);
    return {
      error: true,
      message: err.message || 'Internal Server Error'
    };
  }
}

// generate invoice function 
export async function handleGenerateInvoice(customerId: string | number, env: Bindings, subscription_plan_id: string, eventType: string) {
  try {
    // Get the subscription plan
    const subscriptionPlan = await getSubscriptionPlan(subscription_plan_id, env);
    
    if (!subscriptionPlan) {
      throw new Error("Subscription plan not found.");
    }

    // Get customer information
    const customer = await env.DB.prepare(
      "SELECT email FROM customer WHERE id = ?"
    ).bind(customerId).first();

    if (!customer || !customer.email) {
      throw new Error("Customer not found or email is missing.");
    }

    const amount = subscriptionPlan.price;
    const today = new Date().toISOString().split('T')[0]; // Get the current date

    // Insert a new invoice if eventType is 'invoice_issue'
    let invoiceId = null;
    if (eventType === 'invoice_issue') {
      const invoice = await env.DB.prepare(
        "INSERT INTO invoice (customer_id, amount, due_date, payment_status) VALUES (?, ?, ?, ?)"
      ).bind(customerId, amount, today, 'pending').run();

      invoiceId = invoice.meta.last_row_id;
      if (!invoiceId) {
        throw new Error("Failed to create an invoice.");
      }
    }

    // Determine the email content based on eventType
    let emailContent = '';

    switch (eventType) {
      case 'invoice_issue':
        emailContent = `
          <p>Dear ${customer.email},</p>
          <p>Your subscription billing has been issued.</p>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Due Date:</strong> ${today}</p>
          <p><strong>Status:</strong> Pending</p>
        `;
        break;
      
      case 'payment_success':
        emailContent = `
          <p>Dear ${customer.email},</p>
          <p>Your payment has been successfully processed.</p>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Payment Date:</strong> ${today}</p>
          <p><strong>Status:</strong> Paid</p>
        `;
        break;
      
      case 'payment_failure':
        emailContent = `
          <p>Dear ${customer.email},</p>
          <p>Unfortunately, your payment failed.</p>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Attempted Payment Date:</strong> ${today}</p>
          <p>Please try again or contact support if you need assistance.</p>
        `;
        break;

      default:
        throw new Error("Invalid event type.");
    }


    // Prepare the email content
    const emailData = {
      emailTo: customer.email,
      emailConent: emailContent,
      subject: eventType === 'invoice_issue' ? 'Invoice Issued' :
               eventType === 'payment_success' ? 'Payment Success' :
               'Payment Failure',
    };


    console.log(emailContent);
    console.log(emailData)
    
    // Send the email
    await HandleSendEmails(env, emailData);

    return {
      success: true,
      invoiceId: invoiceId,
      message: `Event ${eventType} handled successfully.`,
    };

  } catch (err: any) {
    console.error(err);
    return {
      error: true,
      message: err.message || 'Internal Server Error'
    };
  }
}
