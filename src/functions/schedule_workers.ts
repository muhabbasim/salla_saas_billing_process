

async function handleBilling(env: any) {
  // Get the current date
  const currentDate = new Date().toISOString().split('T')[0];

  // Query customers whose next billing date is today
  const customersDueForBilling = await env.DB.prepare(
    "SELECT * FROM customer WHERE next_billing_date = ?"
  ).bind(currentDate).all();

  for (const customer of customersDueForBilling.results) {
    await generateInvoice(customer, env);
  }
}

async function generateInvoice(customer: any, env: any) {
  const subscriptionPlan = await getSubscriptionPlan(customer.subscription_plan_id, env);

  const amount = subscriptionPlan.price;

  // Insert a new invoice
  await env.DB.prepare(
    "INSERT INTO invoice (customer_id, amount, due_date, payment_status) VALUES (?, ?, ?, ?)"
  )
    .bind(customer.id, amount, new Date().toISOString().split('T')[0], 'pending')
    .run();

  // Update the customer's next billing date
  const nextBillingDate = calculateNextBillingDate(subscriptionPlan.billing_cycle);
  await env.DB.prepare(
    "UPDATE customer SET next_billing_date = ? WHERE id = ?"
  ).bind(nextBillingDate, customer.id).run();
}

function calculateNextBillingDate(billingCycle: string) {
  const currentDate = new Date();
  if (billingCycle === 'monthly') {
    currentDate.setMonth(currentDate.getMonth() + 1);
  } else if (billingCycle === 'yearly') {
    currentDate.setFullYear(currentDate.getFullYear() + 1);
  }
  return currentDate.toISOString().split('T')[0];
}


async function getSubscriptionPlan(subscription_plan_id: number, env: any) {
  const res = await env.DB.prepare(
    "SELECT * FROM subscription_plan WHERE id = ?"
  ).bind(subscription_plan_id).first();
  return res;
}


