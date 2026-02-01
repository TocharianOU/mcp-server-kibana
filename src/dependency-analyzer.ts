/**
 * Saved Object Dependency Analyzer
 * Analyzes reference relationships between Kibana objects (Dashboard, Visualization, Index Pattern, etc.)
 */

import type { KibanaClient } from "./types";

export interface SavedObjectRef {
  id: string;
  type: string;
  name: string;
}

export interface DependencyNode {
  id: string;
  type: string;
  title?: string;
  referencedBy: SavedObjectRef[]; // Referenced by which objects
  references: SavedObjectRef[];   // References which objects
  depth: number; // Dependency depth
}

export interface DependencyTree {
  root: DependencyNode;
  allNodes: Map<string, DependencyNode>;
  summary: {
    total_objects: number;
    max_depth: number;
    top_referenced: Array<{ id: string; type: string; title?: string; count: number }>;
    orphans: Array<{ id: string; type: string; title?: string }>; // Orphan objects (not referenced by any object)
  };
}

export interface ImpactAnalysis {
  target: { id: string; type: string; title?: string };
  direct_dependencies: number;    // Number of direct dependencies
  indirect_dependencies: number;  // Number of indirect dependencies
  affected_dashboards: SavedObjectRef[]; // Affected Dashboards
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendation: string;
}

/**
 * Build dependency tree
 */
export async function buildDependencyTree(
  kibanaClient: KibanaClient,
  rootId: string,
  rootType: string,
  space?: string,
  maxDepth: number = 5
): Promise<DependencyTree> {
  const allNodes = new Map<string, DependencyNode>();
  const visited = new Set<string>();

  // Recursively traverse dependencies
  async function traverse(id: string, type: string, depth: number): Promise<DependencyNode> {
    const key = `${type}:${id}`;
    
    if (visited.has(key) || depth > maxDepth) {
      return allNodes.get(key) || { id, type, referencedBy: [], references: [], depth };
    }
    
    visited.add(key);

    try {
      // Get object details
      const obj = await kibanaClient.get(`/api/saved_objects/${type}/${id}`, { space });
      
      const node: DependencyNode = {
        id,
        type,
        title: obj.attributes?.title || obj.attributes?.name,
        referencedBy: [],
        references: obj.references || [],
        depth
      };

      allNodes.set(key, node);

      // Recursively process referenced objects
      if (obj.references && obj.references.length > 0) {
        for (const ref of obj.references) {
          const childNode = await traverse(ref.id, ref.type, depth + 1);
          // Record reverse reference
          const childKey = `${ref.type}:${ref.id}`;
          const existingChild = allNodes.get(childKey);
          if (existingChild) {
            existingChild.referencedBy.push({ id, type, name: node.title || id });
          }
        }
      }

      return node;
    } catch (error) {
      return { id, type, referencedBy: [], references: [], depth };
    }
  }

  const root = await traverse(rootId, rootType, 0);

  // Calculate statistics
  let maxDepthFound = 0;
  const referenceCounts = new Map<string, number>();
  const orphans: Array<{ id: string; type: string; title?: string }> = [];

  for (const [key, node] of allNodes.entries()) {
    maxDepthFound = Math.max(maxDepthFound, node.depth);
    
    const refCount = node.referencedBy.length;
    referenceCounts.set(key, refCount);
    
    if (refCount === 0 && key !== `${rootType}:${rootId}`) {
      orphans.push({ id: node.id, type: node.type, title: node.title });
    }
  }

  const topReferenced = Array.from(referenceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => {
      const node = allNodes.get(key)!;
      return { id: node.id, type: node.type, title: node.title, count };
    });

  return {
    root,
    allNodes,
    summary: {
      total_objects: allNodes.size,
      max_depth: maxDepthFound,
      top_referenced: topReferenced,
      orphans: orphans.slice(0, 5)
    }
  };
}

/**
 * Analyze impact scope of deleting/modifying an object
 */
export async function analyzeImpact(
  kibanaClient: KibanaClient,
  targetId: string,
  targetType: string,
  space?: string
): Promise<ImpactAnalysis> {
  // Reverse search: find all objects that reference this object
  try {
    const searchResult = await kibanaClient.post(
      '/api/saved_objects/_find',
      {
        type: ['dashboard', 'visualization', 'lens', 'search', 'map'],
        hasReference: { type: targetType, id: targetId },
        perPage: 100
      },
      { space }
    );

    const directDeps = searchResult.saved_objects || [];
    const affectedDashboards = directDeps
      .filter((obj: any) => obj.type === 'dashboard')
      .map((obj: any) => ({
        id: obj.id,
        type: obj.type,
        name: obj.attributes?.title || obj.id
      }));

    // Recursively find indirect dependencies (what references the dependent objects)
    let indirectCount = 0;
    for (const dep of directDeps) {
      if (dep.type !== 'dashboard') {
        const secondLevel = await kibanaClient.post(
          '/api/saved_objects/_find',
          {
            type: ['dashboard'],
            hasReference: { type: dep.type, id: dep.id },
            perPage: 100
          },
          { space }
        );
        indirectCount += (secondLevel.saved_objects || []).length;
      }
    }

    // Risk assessment
    let riskLevel: ImpactAnalysis['risk_level'] = 'Low';
    if (affectedDashboards.length > 10) riskLevel = 'Critical';
    else if (affectedDashboards.length > 5) riskLevel = 'High';
    else if (affectedDashboards.length > 0) riskLevel = 'Medium';

    let recommendation = '';
    if (riskLevel === 'Critical') {
      recommendation = '⚠️ Warning: Object is heavily referenced by Dashboards. Deletion/modification may cause severe impact. Recommend testing in test space first.';
    } else if (riskLevel === 'High') {
      recommendation = '⚠️ Notice: Object is used by multiple Dashboards. Recommend notifying relevant users.';
    } else if (riskLevel === 'Medium') {
      recommendation = '📌 Note: Object has some dependencies. Confirm if referencing parties need synchronous updates.';
    } else {
      recommendation = '✅ Safe: Object is not referenced by other objects, can be safely deleted/modified.';
    }

    // Get target object info
    const targetObj = await kibanaClient.get(`/api/saved_objects/${targetType}/${targetId}`, { space });

    return {
      target: {
        id: targetId,
        type: targetType,
        title: targetObj.attributes?.title || targetObj.attributes?.name
      },
      direct_dependencies: directDeps.length,
      indirect_dependencies: indirectCount,
      affected_dashboards: affectedDashboards,
      risk_level: riskLevel,
      recommendation
    };
  } catch (error) {
    throw new Error(`Impact analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Format dependency tree to Markdown
 */
export function formatDependencyTreeToMarkdown(tree: DependencyTree): string {
  let md = `# Dependency Analysis\n\n`;
  md += `## 📊 Statistics Summary\n`;
  md += `- Total Objects: ${tree.summary.total_objects}\n`;
  md += `- Max Dependency Depth: ${tree.summary.max_depth}\n`;
  md += `- Orphan Objects: ${tree.summary.orphans.length}\n\n`;

  if (tree.summary.top_referenced.length > 0) {
    md += `## 🔥 Most Referenced Objects\n`;
    tree.summary.top_referenced.forEach((item, index) => {
      md += `${index + 1}. **${item.title || item.id}** (${item.type}) - Referenced ${item.count} times\n`;
    });
    md += '\n';
  }

  if (tree.summary.orphans.length > 0) {
    md += `## 🔍 Orphan Objects (Not Referenced)\n`;
    tree.summary.orphans.forEach(item => {
      md += `- ${item.title || item.id} (${item.type})\n`;
    });
    md += '\n';
  }

  // Tree diagram
  md += `## 🌳 Dependency Tree\n`;
  md += formatNodeTree(tree.root, tree.allNodes, '', new Set());

  return md;
}

function formatNodeTree(
  node: DependencyNode,
  allNodes: Map<string, DependencyNode>,
  prefix: string,
  visited: Set<string>
): string {
  const key = `${node.type}:${node.id}`;
  let result = `${prefix}📦 **${node.title || node.id}** (${node.type})\n`;
  
  if (visited.has(key)) {
    result += `${prefix}  ↻ (Circular Reference)\n`;
    return result;
  }
  
  visited.add(key);

  if (node.references.length > 0) {
    node.references.forEach((ref, index) => {
      const isLast = index === node.references.length - 1;
      const childKey = `${ref.type}:${ref.id}`;
      const childNode = allNodes.get(childKey);
      
      if (childNode) {
        const childPrefix = prefix + (isLast ? '  └─ ' : '  ├─ ');
        const nextPrefix = prefix + (isLast ? '     ' : '  │  ');
        result += formatNodeTree(childNode, allNodes, childPrefix, new Set(visited));
      } else {
        result += `${prefix}${isLast ? '  └─ ' : '  ├─ '}📄 ${ref.name || ref.id} (${ref.type})\n`;
      }
    });
  }

  return result;
}

/**
 * Format impact analysis to Markdown
 */
export function formatImpactAnalysisToMarkdown(analysis: ImpactAnalysis): string {
  let md = `# Impact Analysis\n\n`;
  md += `## 🎯 Target Object\n`;
  md += `- **Name**: ${analysis.target.title || analysis.target.id}\n`;
  md += `- **Type**: ${analysis.target.type}\n`;
  md += `- **ID**: ${analysis.target.id}\n\n`;

  md += `## 📈 Dependency Statistics\n`;
  md += `- Direct Dependencies: ${analysis.direct_dependencies} objects\n`;
  md += `- Indirect Dependencies: ${analysis.indirect_dependencies} objects\n`;
  md += `- Affected Dashboards: ${analysis.affected_dashboards.length}\n\n`;

  const riskEmoji = {
    'Low': '✅',
    'Medium': '⚠️',
    'High': '🔥',
    'Critical': '🚨'
  };

  md += `## ${riskEmoji[analysis.risk_level]} Risk Assessment: ${analysis.risk_level}\n`;
  md += `${analysis.recommendation}\n\n`;

  if (analysis.affected_dashboards.length > 0) {
    md += `## 📊 Affected Dashboard List\n`;
    analysis.affected_dashboards.forEach((dash, index) => {
      md += `${index + 1}. ${dash.name} (ID: ${dash.id})\n`;
    });
  }

  return md;
}
