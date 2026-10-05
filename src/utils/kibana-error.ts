import { KibanaError } from "../types.js";

function formatDetails(details: unknown): string {
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

/** Preserve the HTTP status and Kibana response body instead of collapsing failures to Axios text. */
export function formatKibanaError(error: unknown): string {
  if (error instanceof KibanaError) {
    const status = error.statusCode !== undefined ? `\nStatus: ${error.statusCode}` : "";
    const details = error.details !== undefined ? `\nDetails: ${formatDetails(error.details)}` : "";
    return `Error: ${error.message}${status}${details}`;
  }

  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
