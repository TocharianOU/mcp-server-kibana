
import { z } from "zod";

/**
 * Smart OpenAPI Simplifier
 * Converts verbose OpenAPI Spec into compact format that LLM can easily understand
 */

interface SimplifiedParam {
  name: string;
  in: string;
  required: boolean;
  type: string;
  description?: string;
}

interface SimplifiedEndpoint {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  params: SimplifiedParam[];
  requestBody?: string; // TS Interface style description
  responses: Record<string, string>; // Status code -> Description
}

/**
 * Convert JSON Schema to TypeScript Interface style string
 */
export function schemaToTsType(schema: any, indentLevel = 0): string {
  if (!schema) return 'any';
  
  const indent = '  '.repeat(indentLevel);
  
  // Handle references (already resolved in base-tools, but for robustness)
  if (schema.$ref) {
    return schema.$ref.split('/').pop() || 'object';
  }

  // Handle basic types
  switch (schema.type) {
    case 'string':
      if (schema.enum) return `enum<${schema.enum.map((e: string) => `'${e}'`).join(' | ')}>`;
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      const itemType = schemaToTsType(schema.items, indentLevel);
      return `${itemType}[]`;
  }

  // Handle objects
  if (schema.type === 'object' || schema.properties) {
    if (!schema.properties && !schema.additionalProperties) return 'object';
    
    let lines: string[] = [];
    lines.push('{');
    
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        const isRequired = schema.required?.includes(key);
        const propSchema = prop as any;
        const propType = schemaToTsType(propSchema, indentLevel + 1);
        const desc = propSchema.description ? ` // ${propSchema.description.slice(0, 50)}${propSchema.description.length > 50 ? '...' : ''}` : '';
        
        lines.push(`${indent}  ${key}${isRequired ? '' : '?'}: ${propType};${desc}`);
      }
    }
    
    if (schema.additionalProperties) {
       lines.push(`${indent}  [key: string]: any;`);
    }
    
    lines.push(`${indent}}`);
    return lines.join('\n');
  }

  // Handle union types (oneOf, anyOf, allOf)
  if (schema.oneOf) return schema.oneOf.map((s: any) => schemaToTsType(s, indentLevel)).join(' | ');
  if (schema.anyOf) return schema.anyOf.map((s: any) => schemaToTsType(s, indentLevel)).join(' | ');
  if (schema.allOf) return schema.allOf.map((s: any) => schemaToTsType(s, indentLevel)).join(' & ');

  return 'any';
}

/**
 * Simplify API endpoint details
 */
export function simplifyEndpointDetail(endpoint: any): SimplifiedEndpoint {
  // 1. Simplify parameters
  const params: SimplifiedParam[] = (endpoint.parameters || []).map((p: any) => ({
    name: p.name,
    in: p.in,
    required: p.required || false,
    type: p.schema?.type || 'string',
    description: p.description
  }));

  // 2. Simplify Request Body
  let requestBody = '';
  if (endpoint.requestBody?.content?.['application/json']?.schema) {
    requestBody = schemaToTsType(endpoint.requestBody.content['application/json'].schema);
  }

  // 3. Simplify Responses
  const responses: Record<string, string> = {};
  if (endpoint.responses) {
    for (const [code, resp] of Object.entries(endpoint.responses)) {
      const respObj = resp as any;
      responses[code] = respObj.description || '';
    }
  }

  return {
    method: endpoint.method,
    path: endpoint.path,
    summary: endpoint.summary,
    description: endpoint.description,
    params,
    requestBody: requestBody || undefined,
    responses
  };
}

/**
 * Format to Markdown for LLM readability
 */
export function formatEndpointToMarkdown(detail: SimplifiedEndpoint): string {
  let md = `## ${detail.method} ${detail.path}\n\n`;
  if (detail.summary) md += `**Summary**: ${detail.summary}\n\n`;
  if (detail.description) md += `**Description**: ${detail.description}\n\n`;

  if (detail.params.length > 0) {
    md += `### Parameters\n`;
    detail.params.forEach(p => {
      md += `- \`${p.name}\` (${p.in}, ${p.required ? 'required' : 'optional'}): ${p.description || ''}\n`;
    });
    md += '\n';
  }

  if (detail.requestBody) {
    md += `### Request Body (TypeScript Interface)\n`;
    md += "```typescript\n";
    md += detail.requestBody;
    md += "\n```\n\n";
  }

  if (Object.keys(detail.responses).length > 0) {
    md += `### Responses\n`;
    for (const [code, desc] of Object.entries(detail.responses)) {
      md += `- **${code}**: ${desc}\n`;
    }
  }

  return md;
}
