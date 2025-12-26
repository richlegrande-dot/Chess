/**
 * Example Dynamic Route
 * GET /api/examples/users/:id
 * 
 * This demonstrates dynamic routing with path parameters.
 */

export async function onRequestGet(context) {
  const { id } = context.params;
  
  // In a real application, you would fetch this from a database
  const user = {
    id,
    username: `user${id}`,
    email: `user${id}@example.com`,
    createdAt: new Date().toISOString(),
  };
  
  return Response.json(user);
}

export async function onRequestPut(context) {
  const { id } = context.params;
  const updates = await context.request.json();
  
  return Response.json({
    message: "User updated",
    userId: id,
    updates,
  });
}

export async function onRequestDelete(context) {
  const { id } = context.params;
  
  return Response.json({
    message: "User deleted",
    userId: id,
  });
}
