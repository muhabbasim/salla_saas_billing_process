import { Hono } from 'hono';
import customerRoutes from './routes/customer_rt';
import subscription_planRoutes from './routes/subsctiption_plan_rt';
import invoiceRoutes from './routes/invoice_rt';
import paymentRoutes from './routes/payment_rt';
import { handleBilling } from './functions/billing_engine';
import customer_subscriptionRoutes from './routes/customer_subsction_rt';

type Bindings = {
	DB: D1Database;
  RESEND_API_KEY: KVNamespace;
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', c => c.text('Saas Application'))

// Handle all routes
app.route('/', customerRoutes)
app.route('/', subscription_planRoutes)
app.route('/', invoiceRoutes)
app.route('/', paymentRoutes)
app.route('/customers_subs', customer_subscriptionRoutes)

// Export the fetch handler for HTTP requests
export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
	
  // Export the scheduled handler for cron jobs
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    // Use ctx.waitUntil instead of event.waitUntil
    ctx.waitUntil(handleBilling(env));
  }
};




// import { Hono } from 'hono'
// import customerRoutes from './routes/customer_rt';
// import subscription_planRoutes from './routes/subsctiption_rt';
// import invoiceRoutes from './routes/invoice_rt';
// import paymentRoutes from './routes/payment_rt';
// // import { scheduledHandler } from './functions/schedule_workers';

// type Bindings = {
// 	CASH: KVNamespace
// 	DB: D1Database;
// }

// const app = new Hono<{ Bindings: Bindings }>()

// app.get('/', c => c.text('Saas Application'))


// app.route('/', customerRoutes)
// app.route('/', subscription_planRoutes)
// app.route('/', invoiceRoutes)
// app.route('/', paymentRoutes)


// addEventListener('scheduled', (event) => {
//   event.waitUntil(handleBilling(event));
// });

// async function handleBilling(event: any) {
//   // Get the current date
//   const currentDate = new Date().toISOString().split('T')[0];

//   // Log the triggered cron job
//   console.log("Cron job triggered at:", currentDate);

//   // Simulate billing logic
//   console.log("Processing billing...");

//   // Assuming `env` is the environment with DB and other bindings
//   const env = event.env; // Access env from event
//   console.log("Environment bindings:", env);

//   return currentDate;
// }

// export default app

// app.get("/customers", async (c) => {
// 	const { results: customers } = await c.env.DB.prepare("select * from customer")
// 		.all();
// 	return c.json(customers);
// });


// const username = c.req.param('username') 
// console.log(username)
// // get data from KV
// const cashRes = await c.env.CASH.get(username, 'json')


// if(cashRes) {
// 	return c.json(cashRes)
// } else {
	
// 	//fetch data
// 	const res = await fetch(`https://api.github.com/users/${username}/repos`, {
// 		headers: {
// 			"User-Agent": "CF-Worker"
// 		}
// 	})

// 	const data = await res.json()

// 	if(data) {
// 		// set Data to KV
// 		await c.env.CASH.put(username, JSON.stringify(data))
// 		// Data return 
// 		return c.json(data)
// 	} 
// }





// app.put("/customers/:id", async (c) => {
//   const id = c.req.param('id');  // Retrieve the customer ID from the URL

//   try {
//     const body = await c.req.json(); // Parse the JSON request body

//     // Prepare the SQL query to update the customer's name
//     const result = await c.env.DB.prepare(
//       "UPDATE customer SET name = ? WHERE id = ?"
//     )
// 		.bind(body.name, id)  // Bind the new name and the ID to the query
// 		.run();

//     // Check if the update was successful by inspecting the number of changes
//     if (!result.success) {
//       return c.json({ message: 'Customer not found or no changes made' }, 404);
//     }

//     // Optionally, you can return the updated customer information
//     const updatedCustomer = await c.env.DB.prepare(
//       "SELECT * FROM customer WHERE id = ?"
// 		)
// 		.bind(id)  // Bind the ID to fetch the updated customer
// 		.first();

//     return c.json({ message: 'Customer updated successfully', customer: updatedCustomer });

//   } catch (err: any) {
//     // Log the error and send a structured error response
//     console.error(err);

//     return c.json({
//       error: true,
//       message: err.message || 'Internal Server Error'
//     }, err.status || 500);
//   }
// });