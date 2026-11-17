export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "request_error",
  ) {
    super(message);
  }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message, code: error.code },
      {
        status: error.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
  console.error("Unhandled API error", {
    name: error instanceof Error ? error.name : "unknown",
  });
  return Response.json(
    { error: "Временная ошибка сервера", code: "server_error" },
    { status: 500, headers: { "Cache-Control": "private, no-store" } },
  );
}

export function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}
