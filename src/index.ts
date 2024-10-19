import { Hono } from 'hono';

import customerRoutes from './routes/customer_rt';
import subscription_planRoutes from './routes/subsctiption_plan_rt';
import invoiceRoutes from './routes/invoice_rt';
import paymentRoutes from './routes/payment_rt';
import { handleBillingCycle } from './functions/billing_engine';
import customer_subscriptionRoutes from './routes/customer_subsction_rt';
import durableRoute from './routes/durable_rout';
import { SubscriptionObject } from './durable_object'

type Bindings = {
  RESEND_API_KEY: KVNamespace;
  SUBSCRIPTION_DATA: KVNamespace;
  DB: D1Database;
	SUBSCRIPTION_OBJECT: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', c => c.text('Saas Application'))

// Handle all routes
app.route('/api', customerRoutes)
app.route('/api', subscription_planRoutes)
app.route('/api', invoiceRoutes)
app.route('/api', paymentRoutes)
app.route('/api/customers_subs', customer_subscriptionRoutes)

// Export the fetch handler for HTTP requests
export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
	
  // Export the scheduled handler for cron jobs
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    // Use ctx.waitUntil instead of event.waitUntil
    ctx.waitUntil(handleBillingCycle(env));
  }
};

// Export the Durable Object
export { SubscriptionObject };