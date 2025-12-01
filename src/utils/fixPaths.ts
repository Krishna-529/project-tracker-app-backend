import { db } from '../db';
import { nodes } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';

interface NodeWithChildren {
  id: number;
  parentId: number | null;
  path: string;
}

export async function fixAllPaths() {
  console.log('Starting path fix...');
  
  // Get all nodes
  const allNodes = await db.select().from(nodes);
  console.log(`Found ${allNodes.length} nodes`);
  
  // Build a map of parent to children
  const childrenMap = new Map<number | null, NodeWithChildren[]>();
  
  for (const node of allNodes) {
    const parentId = node.parentId ?? null;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push({
      id: node.id,
      parentId: node.parentId,
      path: node.path,
    });
  }
  
  // Recursive function to fix paths
  async function fixNodeAndDescendants(nodeId: number, parentPath: string | null) {
    const newPath = parentPath ? `${parentPath}.${nodeId}` : String(nodeId);
    
    // Update this node's path
    await db
      .update(nodes)
      .set({ path: newPath, updatedAt: new Date() })
      .where(eq(nodes.id, nodeId));
    
    console.log(`Updated node ${nodeId}: path = ${newPath}`);
    
    // Fix all children
    const children = childrenMap.get(nodeId) || [];
    for (const child of children) {
      await fixNodeAndDescendants(child.id, newPath);
    }
  }
  
  // Start with root nodes (parentId is null)
  const rootNodes = childrenMap.get(null) || [];
  console.log(`Found ${rootNodes.length} root nodes`);
  
  for (const rootNode of rootNodes) {
    await fixNodeAndDescendants(rootNode.id, null);
  }
  
  console.log('Path fix completed!');
}
