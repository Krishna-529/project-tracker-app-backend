import { eq, and, inArray } from 'drizzle-orm';
import { dailyQuestDb } from '../db/dailyQuest';
import { tasks, authUsers } from '../db/dailyQuestSchema';
import type { Node } from '../db/schema';

interface SyncNodeParams {
  node: Node;
  userEmail: string; // Changed from userId to userEmail
}

// Helper function to find Supabase auth user ID by email
const findSupabaseUserId = async (email: string): Promise<string | null> => {
  console.log('[DailyQuest] Looking up Supabase user by email:', email);
  
  try {
    const user = await dailyQuestDb
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, email))
      .limit(1);

    if (user.length === 0) {
      console.error('[DailyQuest] No Supabase user found with email:', email);
      return null;
    }

    console.log('[DailyQuest] Found Supabase user ID:', user[0].id);
    return user[0].id;
  } catch (error) {
    console.error('[DailyQuest] Error looking up Supabase user:', error);
    return null;
  }
};

export const syncTaskToDailyQuest = async ({ node, userEmail }: SyncNodeParams) => {
  console.log('[DailyQuest] Starting sync for node:', { 
    nodeId: node.id, 
    name: node.name, 
    userEmail,
    isTask: node.isTask,
  });

  // Find the Supabase user ID
  const supabaseUserId = await findSupabaseUserId(userEmail);
  if (!supabaseUserId) {
    throw new Error('User not found in Daily Quest database. Please ensure you have logged into Daily Quest at least once.');
  }

  // Map node status to completed boolean
  const completed = node.status === 'done' || node.status === 'archived';

  // Map node status to priority (you can customize this logic)
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if (node.status === 'in_progress') {
    priority = 'high';
  }

  const itemData = {
    userId: supabaseUserId,
    projectId: null, // You can map this to a project in Daily Quest if needed
    title: node.name,
    description: node.metaDescription || null, // Use metaDescription as primary
    dueDate: node.deadline || null, // Will be null if not set
    priority,
    completed,
    projectTags: node.path ? node.path.split('.').filter(Boolean) : [],
    pinnedScope: null,
    pinnedAt: null,
    orderIndex: node.sortOrder,
    projectTrackerNodeId: node.id, // Store reference to original node
    isProject: !node.isTask, // Mark if this is a project
  };

  console.log('[DailyQuest] Item data prepared:', {
    ...itemData,
    userId: supabaseUserId,
    description: itemData.description ? itemData.description.substring(0, 50) + '...' : null,
  });

  try {
    // Check if item already exists by Project Tracker node ID
    console.log('[DailyQuest] Checking for existing item by node ID:', node.id);
    const existingItems = await dailyQuestDb
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.projectTrackerNodeId, node.id),
          eq(tasks.userId, supabaseUserId)
        )
      );

    console.log('[DailyQuest] Found existing items:', existingItems.length);

    if (existingItems.length > 0) {
      const existingItem = existingItems[0];
      console.log('[DailyQuest] Updating existing item:', existingItem.id);
      // Update existing item
      const [updated] = await dailyQuestDb
        .update(tasks)
        .set({
          ...itemData,
          createdAt: existingItem.createdAt, // Keep original creation time
        })
        .where(eq(tasks.id, existingItem.id))
        .returning();
      
      console.log('[DailyQuest] Item updated successfully:', updated.id);
      return { task: updated, action: 'updated' as const };
    } else {
      console.log('[DailyQuest] Creating new item...');
      // Create new item
      const [created] = await dailyQuestDb
        .insert(tasks)
        .values(itemData)
        .returning();
      
      console.log('[DailyQuest] Item created successfully:', created.id);
      return { task: created, action: 'created' as const };
    }
  } catch (error) {
    console.error('[DailyQuest] Error during sync:', error);
    throw error;
  }
};

// Update an item in Daily Quest ONLY if it already exists for this user's account.
// Does not create a new entry.
export const updateTaskInDailyQuestIfExists = async ({ node, userEmail }: SyncNodeParams) => {
  console.log('[DailyQuest] Conditional update for node:', { nodeId: node.id, name: node.name, userEmail });

  const supabaseUserId = await findSupabaseUserId(userEmail);
  if (!supabaseUserId) {
    console.warn('[DailyQuest] Skipping update: Supabase user not found');
    return { updated: false } as const;
  }

  // Map node fields
  const completed = node.status === 'done' || node.status === 'archived';
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if (node.status === 'in_progress') priority = 'high';

  const itemData = {
    userId: supabaseUserId,
    projectId: null,
    title: node.name,
    description: node.metaDescription || null,
    dueDate: node.deadline || null,
    priority,
    completed,
    projectTags: node.path ? node.path.split('.').filter(Boolean) : [],
    pinnedScope: null,
    pinnedAt: null,
    orderIndex: node.sortOrder,
    projectTrackerNodeId: node.id,
    isProject: !node.isTask,
  };

  try {
    const existingItems = await dailyQuestDb
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectTrackerNodeId, node.id), eq(tasks.userId, supabaseUserId)));

    if (existingItems.length === 0) {
      console.log('[DailyQuest] No existing item; not creating during update.');
      return { updated: false } as const;
    }

    const existingItem = existingItems[0];
    const [updated] = await dailyQuestDb
      .update(tasks)
      .set({
        ...itemData,
        createdAt: existingItem.createdAt,
      })
      .where(eq(tasks.id, existingItem.id))
      .returning();

    console.log('[DailyQuest] Conditional update success:', updated.id);
    return { updated: true } as const;
  } catch (error) {
    console.error('[DailyQuest] Conditional update failed:', error);
    return { updated: false } as const;
  }
};

export const deleteTaskFromDailyQuest = async (nodeId: number, userId: string) => {
  // You might want to store a mapping between node IDs and Daily Quest task IDs
  // For now, we'll just delete by title matching
  // This is a limitation - consider adding a mapping table in the future
  console.log(`[DailyQuest] Delete request for node ${nodeId} (user ${userId})`);
  // Implementation would require a mapping table
};

export const deleteNodesFromDailyQuest = async (nodeIds: number[], userEmail: string) => {
  console.log('[DailyQuest] Starting cascade delete for node IDs:', nodeIds);

  const supabaseUserId = await findSupabaseUserId(userEmail);
  if (!supabaseUserId) {
    console.warn('[DailyQuest] Skipping delete: Supabase user not found for email', userEmail);
    return { deletedCount: 0 };
  }

  try {
    const result = await dailyQuestDb
      .delete(tasks)
      .where(and(inArray(tasks.projectTrackerNodeId, nodeIds), eq(tasks.userId, supabaseUserId)))
      .returning({ id: tasks.id, projectTrackerNodeId: tasks.projectTrackerNodeId });

    console.log('[DailyQuest] Cascade delete removed items:', result.length);
    return { deletedCount: result.length };
  } catch (error) {
    console.error('[DailyQuest] Error during cascade delete:', error);
    // Do not throw to avoid blocking main deletion
    return { deletedCount: 0 };
  }
};
