type Bindings = {
  RESEND_API_KEY: KVNamespace;
  SUBSCRIPTION_DATA: KVNamespace;
  DB: D1Database;
}


export class SubscriptionObject {
  state: DurableObjectState;
  env: Bindings;

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.env = env;
  }

  // Handle requests made to the Durable Object
  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(Boolean);

    // console.log
    console.log({'url': url})
    console.log({'path': path})

    if (request.method === 'POST' && path[0] === "customers_subs/assign") {
      const subscriptionData = await request.json();
  
      // console.log
      console.log(subscriptionData)

      return await this.createSubscription(subscriptionData);
    }

    return new Response('Invalid request', { status: 400 });
  }

  // Method to create and store subscription data
  async createSubscription(subscriptionData: any) {
    const { customerId, planId, billingCycle, startDate } = subscriptionData;

    if (!customerId || !planId || !billingCycle || !startDate) {
      return new Response('Missing subscription data', { status: 400 });
    }

    // Store subscription data in the Durable Object's storage
    await this.state.storage.put('subscription', {
      customerId,
      planId,
      billingCycle,
      startDate,
      createdAt: new Date().toISOString(),
    });

    return new Response('Subscription created successfully', { status: 201 });
  }

  // Method to get subscription data
  async getSubscription() {
    const subscription = await this.state.storage.get('subscription');
    if (!subscription) {
      return new Response('No subscription found', { status: 404 });
    }
    return new Response(JSON.stringify(subscription), { status: 200 });
  }
}
