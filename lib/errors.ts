// Error-code conventions. Codes are stable, machine-readable, SCREAMING_SNAKE
// strings returned in API/MCP error responses. Add new ones here, never inline.
export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status(): number {
    return STATUS[this.code];
  }

  toResponse(): Response {
    return Response.json(
      { error: { code: this.code, message: this.message } },
      { status: this.status },
    );
  }
}

/**
 * The user-facing message behind a failure, wherever it came from: an `AppError`
 * thrown locally, or a Convex `ConvexError` carrying our `{ code, message }`
 * payload. Anything else was not meant for a user and gets the generic line.
 */
export function errorMessage(cause: unknown): string {
  if (cause instanceof AppError) return cause.message;
  const data = (cause as { data?: { message?: string } } | null)?.data;
  return data?.message ?? "Something went wrong. Please try again.";
}
