/**
 * Saved Object 依赖关系分析器
 * 用于分析 Kibana 对象（Dashboard、Visualization、Index Pattern 等）之间的引用关系
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
  referencedBy: SavedObjectRef[]; // 被哪些对象引用
  references: SavedObjectRef[];   // 引用了哪些对象
  depth: number; // 依赖深度
}

export interface DependencyTree {
  root: DependencyNode;
  allNodes: Map<string, DependencyNode>;
  summary: {
    total_objects: number;
    max_depth: number;
    top_referenced: Array<{ id: string; type: string; title?: string; count: number }>;
    orphans: Array<{ id: string; type: string; title?: string }>; // 孤立对象（没有被任何对象引用）
  };
}

export interface ImpactAnalysis {
  target: { id: string; type: string; title?: string };
  direct_dependencies: number;    // 直接依赖数量
  indirect_dependencies: number;  // 间接依赖数量
  affected_dashboards: SavedObjectRef[]; // 受影响的 Dashboard
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendation: string;
}

/**
 * 构建依赖关系树
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

  // 递归遍历依赖
  async function traverse(id: string, type: string, depth: number): Promise<DependencyNode> {
    const key = `${type}:${id}`;
    
    if (visited.has(key) || depth > maxDepth) {
      return allNodes.get(key) || { id, type, referencedBy: [], references: [], depth };
    }
    
    visited.add(key);

    try {
      // 获取对象详情
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

      // 递归处理引用的对象
      if (obj.references && obj.references.length > 0) {
        for (const ref of obj.references) {
          const childNode = await traverse(ref.id, ref.type, depth + 1);
          // 记录反向引用
          const childKey = `${ref.type}:${ref.id}`;
          const existingChild = allNodes.get(childKey);
          if (existingChild) {
            existingChild.referencedBy.push({ id, type, name: node.title || id });
          }
        }
      }

      return node;
    } catch (error) {
      console.error(`Failed to fetch ${type}:${id}`, error);
      return { id, type, referencedBy: [], references: [], depth };
    }
  }

  const root = await traverse(rootId, rootType, 0);

  // 计算统计信息
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
 * 分析删除/修改某个对象的影响范围
 */
export async function analyzeImpact(
  kibanaClient: KibanaClient,
  targetId: string,
  targetType: string,
  space?: string
): Promise<ImpactAnalysis> {
  // 反向搜索：找到所有引用这个对象的对象
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

    // 递归查找间接依赖（被依赖的对象又被什么引用）
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

    // 风险评估
    let riskLevel: ImpactAnalysis['risk_level'] = 'Low';
    if (affectedDashboards.length > 10) riskLevel = 'Critical';
    else if (affectedDashboards.length > 5) riskLevel = 'High';
    else if (affectedDashboards.length > 0) riskLevel = 'Medium';

    let recommendation = '';
    if (riskLevel === 'Critical') {
      recommendation = '⚠️ 警告：该对象被大量 Dashboard 引用。删除或修改可能导致严重影响。建议先在测试空间验证。';
    } else if (riskLevel === 'High') {
      recommendation = '⚠️ 注意：该对象被多个 Dashboard 使用。建议通知相关用户。';
    } else if (riskLevel === 'Medium') {
      recommendation = '📌 提示：该对象有一定依赖。请确认是否需要同步更新引用方。';
    } else {
      recommendation = '✅ 安全：该对象没有被其他对象引用，可以安全删除/修改。';
    }

    // 获取目标对象信息
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
 * 格式化依赖树为 Markdown
 */
export function formatDependencyTreeToMarkdown(tree: DependencyTree): string {
  let md = `# 依赖关系分析\n\n`;
  md += `## 📊 统计摘要\n`;
  md += `- 总对象数：${tree.summary.total_objects}\n`;
  md += `- 最大依赖深度：${tree.summary.max_depth}\n`;
  md += `- 孤立对象数：${tree.summary.orphans.length}\n\n`;

  if (tree.summary.top_referenced.length > 0) {
    md += `## 🔥 最常被引用的对象\n`;
    tree.summary.top_referenced.forEach((item, index) => {
      md += `${index + 1}. **${item.title || item.id}** (${item.type}) - 被引用 ${item.count} 次\n`;
    });
    md += '\n';
  }

  if (tree.summary.orphans.length > 0) {
    md += `## 🔍 孤立对象（未被引用）\n`;
    tree.summary.orphans.forEach(item => {
      md += `- ${item.title || item.id} (${item.type})\n`;
    });
    md += '\n';
  }

  // 树状图
  md += `## 🌳 依赖树\n`;
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
    result += `${prefix}  ↻ (循环引用)\n`;
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
 * 格式化影响分析为 Markdown
 */
export function formatImpactAnalysisToMarkdown(analysis: ImpactAnalysis): string {
  let md = `# 影响范围分析\n\n`;
  md += `## 🎯 目标对象\n`;
  md += `- **名称**: ${analysis.target.title || analysis.target.id}\n`;
  md += `- **类型**: ${analysis.target.type}\n`;
  md += `- **ID**: ${analysis.target.id}\n\n`;

  md += `## 📈 依赖统计\n`;
  md += `- 直接依赖：${analysis.direct_dependencies} 个对象\n`;
  md += `- 间接依赖：${analysis.indirect_dependencies} 个对象\n`;
  md += `- 受影响的 Dashboard：${analysis.affected_dashboards.length} 个\n\n`;

  const riskEmoji = {
    'Low': '✅',
    'Medium': '⚠️',
    'High': '🔥',
    'Critical': '🚨'
  };

  md += `## ${riskEmoji[analysis.risk_level]} 风险评估: ${analysis.risk_level}\n`;
  md += `${analysis.recommendation}\n\n`;

  if (analysis.affected_dashboards.length > 0) {
    md += `## 📊 受影响的 Dashboard 列表\n`;
    analysis.affected_dashboards.forEach((dash, index) => {
      md += `${index + 1}. ${dash.name} (ID: ${dash.id})\n`;
    });
  }

  return md;
}
