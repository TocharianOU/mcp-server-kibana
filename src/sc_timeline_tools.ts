import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Security Timeline Tools (sc_timeline_*) - Kibana Security Timeline Management Tools
 * 
 * This module provides essential tools for querying and managing Security Timelines in Kibana.
 * Timelines are essential for security event investigation, threat hunting, and incident response.
 * 
 * Simplified to focus on read operations and simple toggles.
 * All tools are based on the official Kibana Security Timeline API specification.
 */

// ============================================================================
// TIMELINE QUERY TOOLS (sc_timeline_*)
// ============================================================================

/**
 * Get timeline or timeline template details
 */
async function sc_get_timeline_impl(
  kibanaClient: KibanaClient,
  id?: string,
  templateTimelineId?: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    if (id) {
      params.append('id', id);
    }
    if (templateTimelineId) {
      params.append('template_timeline_id', templateTimelineId);
    }

    const url = `/api/timeline${params.toString() ? '?' + params.toString() : ''}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Timeline retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving timeline: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Search timelines with filters
 */
async function sc_find_timelines_impl(
  kibanaClient: KibanaClient,
  search?: string,
  sortField?: string,
  sortOrder?: 'asc' | 'desc',
  pageSize?: number,
  pageIndex?: number,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    if (search) {
      params.append('search', search);
    }
    if (sortField) {
      params.append('sort_field', sortField);
    }
    if (sortOrder) {
      params.append('sort_order', sortOrder);
    }
    if (pageSize) {
      params.append('page_size', pageSize.toString());
    }
    if (pageIndex) {
      params.append('page_index', pageIndex.toString());
    }

    const url = `/api/timelines${params.toString() ? '?' + params.toString() : ''}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Found timelines:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error finding timelines: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Mark or unmark timeline as favorite
 */
async function sc_favorite_timeline_impl(
  kibanaClient: KibanaClient,
  timelineId: string,
  templateTimelineId?: string,
  templateTimelineVersion?: number,
  timelineType?: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const body: any = {
      timelineId
    };
    
    if (templateTimelineId) {
      body.templateTimelineId = templateTimelineId;
    }
    if (templateTimelineVersion) {
      body.templateTimelineVersion = templateTimelineVersion;
    }
    if (timelineType) {
      body.timelineType = timelineType;
    }

    const response = await kibanaClient.patch('/api/timeline/_favorite', body, { space });

    return {
      content: [{
        type: "text",
        text: `Timeline favorite status toggled:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error toggling timeline favorite: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get timeline notes
 */
async function sc_get_timeline_notes_impl(
  kibanaClient: KibanaClient,
  timelineId?: string,
  eventId?: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    if (timelineId) {
      params.append('timelineId', timelineId);
    }
    if (eventId) {
      params.append('eventId', eventId);
    }

    const url = `/api/note${params.toString() ? '?' + params.toString() : ''}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Timeline notes retrieved:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving timeline notes: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all Security Timeline tools
 */
export async function registerSCTimelineTools(
  serverBase: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  // sc_get_timeline
  serverBase.tool(
    "sc_get_timeline",
    "Get timeline or timeline template details by ID. Timelines are used for security event investigation.",
    z.object({
      id: z.string().optional().describe("Timeline saved object ID"),
      templateTimelineId: z.string().optional().describe("Template timeline ID"),
      space: z.string().optional().describe("Target Kibana space (optional)")
    }),
    async (args) => {
      return sc_get_timeline_impl(
        kibanaClient,
        args.id,
        args.templateTimelineId,
        args.space || defaultSpace
      );
    }
  );

  // sc_find_timelines
  serverBase.tool(
    "sc_find_timelines",
    "Search and filter timelines. Returns a list of timelines matching the search criteria.",
    z.object({
      search: z.string().optional().describe("Search text to filter timelines by title"),
      sortField: z.string().optional().describe("Field to sort by (e.g., 'updated', 'created')"),
      sortOrder: z.enum(['asc', 'desc']).optional().describe("Sort order"),
      pageSize: z.number().optional().describe("Number of results per page"),
      pageIndex: z.number().optional().describe("Page number (0-based)"),
      space: z.string().optional().describe("Target Kibana space (optional)")
    }),
    async (args) => {
      return sc_find_timelines_impl(
        kibanaClient,
        args.search,
        args.sortField,
        args.sortOrder,
        args.pageSize,
        args.pageIndex,
        args.space || defaultSpace
      );
    }
  );

  // sc_favorite_timeline
  serverBase.tool(
    "sc_favorite_timeline",
    "Mark or unmark a timeline as favorite. This is a simple toggle operation.",
    z.object({
      timelineId: z.string().describe("Timeline ID to toggle favorite status"),
      templateTimelineId: z.string().optional().describe("Template timeline ID (if applicable)"),
      templateTimelineVersion: z.number().optional().describe("Template timeline version"),
      timelineType: z.string().optional().describe("Timeline type (default, template, or custom)"),
      space: z.string().optional().describe("Target Kibana space (optional)")
    }),
    async (args) => {
      return sc_favorite_timeline_impl(
        kibanaClient,
        args.timelineId,
        args.templateTimelineId,
        args.templateTimelineVersion,
        args.timelineType,
        args.space || defaultSpace
      );
    }
  );

  // sc_get_timeline_notes
  serverBase.tool(
    "sc_get_timeline_notes",
    "Get notes associated with a timeline or specific event. Notes provide context for investigation.",
    z.object({
      timelineId: z.string().optional().describe("Timeline ID to get notes for"),
      eventId: z.string().optional().describe("Specific event ID to get notes for"),
      space: z.string().optional().describe("Target Kibana space (optional)")
    }),
    async (args) => {
      return sc_get_timeline_notes_impl(
        kibanaClient,
        args.timelineId,
        args.eventId,
        args.space || defaultSpace
      );
    }
  );


}
