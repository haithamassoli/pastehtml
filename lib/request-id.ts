// Request / correlation ID. Reuse an incoming header if present so IDs flow
// across Next.js and Convex; otherwise mint one.
const HEADER = "x-request-id";

// Vercel stamps every invocation with its own id and files its platform logs
// under it. Adopting it when the caller sent nothing is what makes a line in
// our logs findable in Vercel's, and the other way round, for free.
const PLATFORM_HEADER = "x-vercel-id";

export function requestId(req?: Request): string {
  return (
    req?.headers.get(HEADER) ??
    req?.headers.get(PLATFORM_HEADER) ??
    crypto.randomUUID()
  );
}

export { HEADER as REQUEST_ID_HEADER, PLATFORM_HEADER as PLATFORM_ID_HEADER };
