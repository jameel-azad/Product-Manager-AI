/** Extract a human-readable string from any Axios / FastAPI error. */
export function getErrorMessage(err: any, fallback = 'Something went wrong.'): string {
  const detail = err?.response?.data?.detail;

  // Pydantic v2 validation errors: detail is an array of {loc, msg, type, input}
  if (Array.isArray(detail)) {
    return detail.map((d: any) => d?.msg ?? JSON.stringify(d)).join(', ');
  }

  if (typeof detail === 'string') return detail;

  const msg = err?.response?.data?.message ?? err?.message;
  if (typeof msg === 'string') return msg;

  return fallback;
}
