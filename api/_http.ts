export class HttpError extends Error {
  statusCode: number;
  expose: boolean;

  constructor(statusCode: number, message: string, expose = statusCode >= 400 && statusCode < 500) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.expose = expose;
  }
}

export function sendJson(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

export function requireMethod(req: any, res: any, method: string) {
  if (req.method === method) return true;

  res.setHeader?.('Allow', method);
  sendJson(res, 405, { error: 'Method not allowed.' });
  return false;
}

export function requirePost(req: any, res: any) {
  return requireMethod(req, res, 'POST');
}

export function handleApiError(res: any, error: unknown, fallbackMessage = 'Internal server error.') {
  if (error instanceof HttpError && error.expose) {
    sendJson(res, error.statusCode, { error: error.message });
    return;
  }

  console.error(error);
  sendJson(res, 500, { error: fallbackMessage });
}
