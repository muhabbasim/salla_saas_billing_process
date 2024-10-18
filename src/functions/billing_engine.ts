import { calculateNextBillingDate, getSubscriptionPlan, handleGenerateInvoice } from "./utils";

export async function handleBillingCycle(env: any) {

  console.log("Billing cycle job triggered.");

  try {

    const today = new Date().toISOString().split('T')[0];
    console.log(`Today's date: ${today}`);

    const customersDueForBilling = await env.DB.prepare(
      "SELECT * FROM customer WHERE next_billing_date = ? AND subscription_status = 'active'"
    ).bind(today).all();

    console.log(customersDueForBilling.results)

    if (!customersDueForBilling || customersDueForBilling.results.length === 0) {
      console.log("No customers due for billing today.");
      return;
    }

    for (const customer of customersDueForBilling.results) {
      
      console.log(`Processing customer ${customer.id}...`);
      
      // Get the subscription plan
      const subscriptionPlan = await getSubscriptionPlan(customer.subscription_plan_id, env);
      if (!subscriptionPlan) {
        console.error(`Subscription plan not found for customer ${customer.id}`);
        continue;
      }
      console.log({'subscriptionPlan': subscriptionPlan})
      
      // genere invoice 
      const invoice = await handleGenerateInvoice(customer.id, env, subscriptionPlan.id, 'invoice_issue');
      console.log({'invoice': invoice})
      
      if (!invoice || invoice.error) {
        console.error(`Failed to generate invoice for customer ${customer.id}`);
        continue;
      }

      // add the next billing
      const nextBillingDate = calculateNextBillingDate(subscriptionPlan.billing_cycle);
      console.log({'next billing': nextBillingDate})

      // update customer 
      await env.DB.prepare("UPDATE customer SET next_billing_date = ? WHERE id = ?")
        .bind(nextBillingDate, customer.id)
        .run();
      console.log(`Invoice generated and next billing date updated for customer ${customer.id}`);
    }
  } catch (err: any) {
    console.error("Error processing billing cycle:", err.message);
  }
}