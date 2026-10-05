import { z } from "zod";
import { KibanaError } from "./types.js";
import type { KibanaClient, ServerBase, ToolResponse } from "./types";
import { formatKibanaError } from "./utils/kibana-error.js";
import { checkTokenLimit } from "./utils/token-limiter.js";

export const elasticsearchSearchBodySchema = z.record(z.any()).refine(
  (body) => Object.keys(body).length > 0,
  "Search body must not be empty"
);

export const elasticsearchSearchInputSchema = z.object({
  index: z.string().trim().min(1).describe(
    "REQUIRED: Elasticsearch index or bounded index pattern, for example 'application-logs-*'. Do not use '*' or '_all'."
  ),
  body: elasticsearchSearchBodySchema.describe(
    `REQUIRED: Elasticsearch _search request body using Query DSL, not Kibana KQL. Translate KQL-style user intent into Query DSL before calling this tool. For logs, normally include: a small size (for example 20), a range filter on the timestamp field, useful _source fields only, and sort by timestamp when order matters. Example: {"size":20,"_source":["@timestamp","message","trace.id"],"sort":[{"@timestamp":"desc"}],"query":{"bool":{"filter":[{"range":{"@timestamp":{"gte":"2025-01-15T10:00:00Z","lt":"2025-01-15T11:00:00Z"}}}]}}}. After finding a trace or correlation id, prefer a second narrow search for that id and a small time window instead of repeatedly scanning a broad range.`
  ),
  space: z.string().optional().describe(
    "Target Kibana space (optional, defaults to configured space)."
  ),
  break_token_rule: z.boolean().optional().default(false).describe(
    "Emergency only: bypass the response token limit. Prefer reducing body.size, narrowing the time range, or limiting _source fields."
  )
});

export function registerElasticsearchSearchTools(
  server: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string,
  maxTokenCall = 20000
) {
  server.tool(
    "search_elasticsearch",
    `Search Elasticsearch documents, logs, and aggregations through Kibana using Elasticsearch Query DSL.

USE THIS TOOL whenever the task is to find or inspect Elasticsearch data. Do
not first search Kibana API paths and do not call /api/console/proxy through
execute_kb_api for Elasticsearch searches. The Console proxy can require the
Kibana Dev Tools privilege even when the configured user is allowed to read the
target indices. This tool uses the user's existing Elasticsearch permissions.

SEARCH STRATEGY FOR LOGS:
1. Start with the narrowest known index pattern and a small time window.
2. Set size explicitly (usually 10-50; maximum 100).
3. Request only useful _source fields when exploring high-volume logs.
4. Sort by the timestamp field if chronology matters.
5. After finding a trace/correlation id, narrow follow-up searches to that id
   and a small surrounding time window.
6. Prefer exact term/keyword filters when the field mapping supports them; use
   match/query_string only when text analysis is intended.

The body is Elasticsearch Query DSL, not Kibana KQL. If the user describes a
filter in KQL terms, translate the intent to Query DSL before calling the tool.

A bare '*' or '_all' index, an empty body, and body.size > 100 are rejected.
Avoid broad match_all searches. Aggregations are supported through the same
body. The returned hits preserve the original _source, including dynamic/custom
properties.

This uses Kibana's internal /internal/search/es endpoint, so its contract can
change between Kibana versions.`,
    elasticsearchSearchInputSchema,
    {
      title: "Search Elasticsearch",
      readOnlyHint: true,
      openWorldHint: true
    },
    async ({ index, body, space, break_token_rule }): Promise<ToolResponse> => {
      try {
        const normalizedIndex = index.trim();
        if (normalizedIndex === "*" || normalizedIndex.toLowerCase() === "_all") {
          return {
            content: [{
              type: "text",
              text: "Error: use an explicit index or bounded index pattern; '*' and '_all' are not allowed"
            }],
            isError: true
          };
        }

        if (typeof body.size === "number" && (!Number.isInteger(body.size) || body.size < 0 || body.size > 100)) {
          return {
            content: [{
              type: "text",
              text: "Error: body.size must be an integer between 0 and 100"
            }],
            isError: true
          };
        }

        const targetSpace = space || defaultSpace;
        const response = await kibanaClient.post(
          "/internal/search/es",
          {
            params: {
              index: normalizedIndex,
              body
            }
          },
          { space }
        );

        const result: ToolResponse = {
          content: [{
            type: "text",
            text: `[Space: ${targetSpace}] Elasticsearch search response for ${JSON.stringify(normalizedIndex)}: ${JSON.stringify(response, null, 2)}`
          }]
        };

        const tokenCheck = checkTokenLimit(result, maxTokenCall, break_token_rule ?? false);
        if (!tokenCheck.allowed) {
          return {
            content: [{
              type: "text",
              text: `Token limit exceeded: search result contains about ${tokenCheck.tokens} tokens (limit: ${maxTokenCall}).\n\n` +
                "Retry with a smaller body.size, a narrower index/time range, or fewer _source fields. " +
                "For log investigations, find a trace/correlation id first and then query that id in a small time window. " +
                "Use break_token_rule only when the full response is genuinely required."
            }],
            isError: true
          };
        }

        return result;
      } catch (error) {
        const hint = error instanceof KibanaError && error.statusCode === 403
          ? "\nHint: this tool already avoids the Dev Tools Console proxy. Check the configured user's Kibana/Elasticsearch read permissions for the requested indices; do not fall back to /api/console/proxy unless Dev Tools access is explicitly available."
          : error instanceof KibanaError && error.statusCode === 404
            ? "\nHint: /internal/search/es is an internal Kibana API. This Kibana version may use a different internal search contract."
            : "";
        return {
          content: [{
            type: "text",
            text: formatKibanaError(error) + hint
          }],
          isError: true
        };
      }
    }
  );
}
