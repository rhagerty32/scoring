export function json(data: unknown, init?: number | ResponseInit) {
  const status = typeof init === "number" ? init : (init as ResponseInit | undefined)?.status;
  return Response.json(data, typeof init === "number" ? { status: init } : init ?? { status: status ?? 200 });
}

export function badRequest(message: string) {
  return json({ error: message }, 400);
}

export function unauthorized(message = "Unauthorized") {
  return json({ error: message }, 401);
}

export function notFound(message = "Not found") {
  return json({ error: message }, 404);
}

export function conflict(message: string) {
  return json({ error: message }, 409);
}
