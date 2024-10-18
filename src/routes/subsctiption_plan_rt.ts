import { Hono } from 'hono';

type Bindings = {
  CASH: KVNamespace;
  DB: D1Database;
};

const subscription_plan = new Hono<{ Bindings: Bindings }>();

// get all customers
subscription_plan.get("/subscriptions", async (c) => {

  try {
    const res = await c.env.DB
		.prepare("select * from subscription_plan")
		.all();
	
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


// get single subscription
subscription_plan.get("/subscriptions/:id", async (c) => {

  try {
    const id = c.req.param('id') 

    const subscription = await c.env.DB.prepare(
      "SELECT * FROM subscription_plan WHERE id = ?"
    )
    .bind(id)
    .first(); 

    if (!subscription) {
      return c.json({ message: 'subscriptions not found' }, 404);
    }

    return c.json(subscription);
  } catch (err: any) {
    
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// Add a new subscription plan
subscription_plan.post("/subscriptions/create", async (c) => {
  try {

    const body = await c.req.json(); 
    const { name, billing_cycle, price, status } = body;

    // Ensure required fields are present
    if (!name || !billing_cycle || !price || !status) {
      return c.json({ message: 'Missing required fields' }, 400);
    }

    // Check if the subscription plan with the same name already exists
    const existingPlan = await c.env.DB.prepare(
      "SELECT * FROM subscription_plan WHERE name = ?"
    ).bind(name).first();

    if (existingPlan) {
      return c.json({ message: 'Subscription plan with this name already exists' }, 400);
    }

    // insert data to the base
    const result = await c.env.DB.prepare(
      "INSERT INTO subscription_plan (name, billing_cycle, price, status) VALUES (?, ?, ?, ?)"
    )
    .bind(name, billing_cycle, price, status)
    .run();

    // Check if the insertion was successful
    if (!result.success) {
      return c.json({ message: 'Failed to add subscription plan' }, 500);
    }

    // Get the last inserted row's ID
    const lastInsertId = result.meta?.last_row_id;

    const newSubscriptionPlan = await c.env.DB.prepare(
      "SELECT * FROM subscription_plan WHERE id = ?"
    )
    .bind(lastInsertId)
    .first();

    return c.json({ message: 'Subscription plan added successfully', subscription_plan: newSubscriptionPlan });

  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// Update a subscription plan
subscription_plan.put("/subscriptions/:id", async (c) => {
  const id = c.req.param('id');  // Retrieve the subscription plan ID from the URL

  try {
    const body = await c.req.json(); // Parse the JSON request body
    const fields = Object.keys(body);

    if (fields.length === 0) {
      return c.json({ message: 'No fields provided to update' }, 400);
    }

    // If the name is being updated, check if another subscription plan with the same name exists
    if (body.name) {
      const existingPlan = await c.env.DB.prepare(
        "SELECT * FROM subscription_plan WHERE name = ? AND id != ?"
      ).bind(body.name, id).first();

      if (existingPlan) {
        return c.json({ message: 'Subscription plan with this name already exists' }, 400);
      }
    }

    // Dynamically build the SQL SET clause
    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const query = `UPDATE subscription_plan SET ${setClause} WHERE id = ?`;
    const values = [...fields.map(field => body[field]), id];

    // Prepare and run the SQL query to update the subscription plan
    const res = await c.env.DB.prepare(query)
    .bind(...values)  // Bind the dynamic fields and the subscription plan ID
    .run();

    // Check if the update was successful
    if (!res.success) {
      return c.json({ message: 'Subscription plan not found or no changes made' }, 404);
    }

    // Optionally, return the updated subscription plan information
    const updatedSubscriptionPlan = await c.env.DB.prepare(
      "SELECT * FROM subscription_plan WHERE id = ?"
    )
    .bind(id)
    .first();

    return c.json({ message: 'Subscription plan updated successfully', subscription_plan: updatedSubscriptionPlan });

  } catch (err: any) {
    console.error(err);

    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


export default subscription_plan;