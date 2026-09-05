function redact(value) {
  return String(value || "")
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@")
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(password|token|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]");
}

function errorDetails(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redact(error.message),
      stack: redact(error.stack),
    };
  }
  return { name: "NonErrorThrow", message: redact(error) };
}

export function logServerError(error, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: "error",
    errorId: context.errorId || null,
    code: context.code || "INTERNAL_ERROR",
    method: context.method || null,
    route: context.route || null,
    userId: context.userId ? String(context.userId) : null,
    ...errorDetails(error),
  };
  console.error(JSON.stringify(entry));
}

export function logRequestError(error, req, code = "INTERNAL_ERROR") {
  logServerError(error, {
    errorId: req?.errorId,
    code,
    method: req?.method,
    route: req?.baseUrl || req?.path,
    userId: req?.user?.id || req?.user?._id,
  });
}
