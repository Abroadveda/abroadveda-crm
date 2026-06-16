// Convert error objects into user-friendly messages
export function getErrorMessage(error) {
  if (!error) return "An unexpected error occurred";

  const msg = error.message || error.toString();

  // Network errors
  if (msg.includes("fetch") || msg.includes("network")) {
    return "Network error — check your internet connection";
  }

  // RLS (Row Level Security) policy errors
  if (msg.includes("RLS") || msg.includes("denied")) {
    return "Access denied — you don't have permission for this action";
  }

  // Database constraint errors
  if (msg.includes("constraint") || msg.includes("unique")) {
    return "Duplicate or invalid data — check your inputs";
  }

  // Validation errors
  if (msg.includes("invalid") || msg.includes("format")) {
    return "Invalid format — check your inputs";
  }

  // Supabase auth errors
  if (msg.includes("401") || msg.includes("unauthorized")) {
    return "Session expired — please log in again";
  }

  // Fallback: try to extract meaningful part of error
  if (msg.length > 100) {
    return msg.substring(0, 100) + "...";
  }

  return msg;
}

// Log error for debugging
export function logError(context, error) {
  const timestamp = new Date().toISOString();
  const msg = getErrorMessage(error);
  console.error(`[${timestamp}] ${context}:`, error);
  return msg;
}
