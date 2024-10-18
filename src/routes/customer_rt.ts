import { Hono } from 'hono';

type Bindings = {
  CASH: KVNamespace;
  DB: D1Database;
};

const customer = new Hono<{ Bindings: Bindings }>();


// add customer
customer.post("/customers/create", async (c) => {
    
  try {
    
    // Parse the JSON request body
    const body = await c.req.json();
    const { name, email, subscription_plan_id, subscription_status } = body;
    
    // Ensure required fields are present
    if (!name || !email || !subscription_plan_id || subscription_status === undefined) {
      return c.json({ message: 'Missing required fields' }, 400);
    }

    const res = await c.env.DB.prepare(
      "INSERT INTO customer (name, email, subscription_plan_id, subscription_status) VALUES (?, ?, ?, ?)"
    )
    .bind(name, email, subscription_plan_id, subscription_status)
    .run();

    // Check if the insertion was successful
    if (!res.success) {
      return c.json({ message: 'Failed to add customer' }, 500);
    }

    // the the user_id has already added
    const lastInsertRowId = res.meta.last_row_id

    const newCustomer = await c.env.DB.prepare(
      "SELECT * FROM customer WHERE id = ?"
    )
    .bind(lastInsertRowId)
    .first();

    return c.json({ message: 'Customer added successfully', customer: newCustomer });
    
  } catch (err: any) {
    console.error(err);
    return c.json({ error: true, message: err.message || 'Internal Server Error' }, 500);
  }
  
})

// get all customer
customer.get("/customers", async (c) => {

  try {
    
    const res = await c.env.DB
    .prepare("select * from customer")
    .all();
    
    const customers = res.results
    return c.json(customers);

  } catch (err: any) {
    console.error(err);
    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, 500);
  }
});


// get single customer
customer.get("/customers/:id", async (c) => {

	const id = c.req.param('id') 

  // Prepare the SQL query to select the customer with the given id
  const { results: customer } = await c.env.DB.prepare(
    "SELECT * FROM customer WHERE id = ?"
  )
  .bind(id)
  .all(); // Bind the id parameter to the SQL query

	if (customer.length === 0) {
    return c.json({ message: 'Customer not found' }, 404);
  }

	return c.json(customer);
});


// update customer
customer.put("/customers/:id", async (c) => {
  const id = c.req.param('id');  // Retrieve the customer ID from the URL

  try {
    const body = await c.req.json(); // Parse the JSON request body
		const fields = Object.keys(body);

		if (fields.length === 0) {
      return c.json({ message: 'No fields provided to update' }, 400);
    }

		const setClause = fields.map((field) => `${field} = ?`).join(", ");
		const query = `UPDATE customer SET ${setClause} WHERE id = ?`;

		const values = [...fields.map(field => body[field]), id];
    // Prepare the SQL query to update the customer's name

    // Run the query with the dynamic fields and values
    const result = await c.env.DB.prepare(query)
    .bind(...values)  // Spread the values array for binding
    .run();

    // Check if the update was successful by inspecting the number of changes
    if (!result.success) {
      return c.json({ message: 'Customer not found or no changes made' }, 404);
    }

    // Optionally, you can return the updated customer information
    const updatedCustomer = await c.env.DB.prepare(
      "SELECT * FROM customer WHERE id = ?"
		)
		.bind(id)  // Bind the ID to fetch the updated customer
		.first();

    return c.json({ message: 'Customer updated successfully', customer: updatedCustomer });

  } catch (err: any) {
    // Log the error and send a structured error response
    console.error(err);

    return c.json({
      error: true,
      message: err.message || 'Internal Server Error'
    }, err.status || 500);
  }
});

export default customer;