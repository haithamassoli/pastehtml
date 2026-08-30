// Request / correlation ID. Reuse an incoming header if present so IDs flow
// across Next.js and Convex; otherwise mint one.
const HEADER = "x-request-id";

export function requestId(req?: Request): string {
  return req?.headers.get(HEADER) ?? crypto.randomUUID();
}

export { HEADER as REQUEST_ID_HEADER };
