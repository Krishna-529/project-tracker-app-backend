import type { Request } from 'express';
import { eq, asc, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';


import { db } from '../db';
import { nodes } from '../db/schema';
import { AppError } from '../errors/AppError';
import { catchAsync } from '../utils/catchAsync';
import { syncTaskToDailyQuest, deleteNodesFromDailyQuest, updateTaskInDailyQuestIfExists } from '../services/dailyQuestService';
import type {
  CreateNodeInput,
  MoveNodeInput,
  ReorderNodesInput,
  UpdateNodeInput,
} from '../validators/nodeSchemas';

const computeEtag = (lastUpdated: Date | null, total: number) => {
  const base = `${lastUpdated?.toISOString() ?? '0'}:${total}`;
  return createHash('sha256').update(base).digest('base64url');
};

export const getNodeTree = catchAsync(async (req: Request, res) => {
  const userId = req.user!.id;
  const metaResult = await db.execute<{
    last_updated: Date | null;
    total: number;
  }>(sql`SELECT max(updated_at) AS last_updated, count(*)::int AS total FROM nodes WHERE user_id = ${userId}`);

  const metaRow = metaResult[0] ?? { last_updated: null, total: 0 };
  const lastUpdatedValue = metaRow.last_updated
    ? metaRow.last_updated instanceof Date
      ? metaRow.last_updated
      : new Date(metaRow.last_updated)
    : null;

  const etag = computeEtag(lastUpdatedValue, Number(metaRow.total ?? 0));

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  const tree = await db
    .select({
      id: nodes.id,
      name: nodes.name,
      parentId: nodes.parentId,
      isTask: nodes.isTask,
      status: nodes.status,
      path: nodes.path,
      sortOrder: nodes.sortOrder,
      deadline: nodes.deadline,
    })
    .from(nodes)
    .where(eq(nodes.userId, userId))
    .orderBy(asc(nodes.parentId), asc(nodes.sortOrder), asc(nodes.id));


  res.setHeader('ETag', etag);
  return res.json({
    data: tree,
    meta: {
      count: tree.length,
      lastUpdated: lastUpdatedValue?.toISOString() ?? null,
    },
  });
});

export const getNodeById = catchAsync(async (req: Request, res) => {
  const id = Number(req.params.id);
  const userId = req.user!.id;

  const node = await db.query.nodes.findFirst({
    where: and(eq(nodes.id, id), eq(nodes.userId, userId)),
  });

  if (!node) {
    throw new AppError('Node not found', 404);
  }

  return res.json({ data: node });

});

export const createNode = catchAsync(async (req: Request, res) => {
  const body = req.body as CreateNodeInput;
  const userId = req.user!.id;

  const insertPayload: Partial<typeof nodes.$inferInsert> = {
    name: body.name,
    isTask: body.isTask,
    parentId: body.parentId ?? null,
    userId,
  };


  if (body.status !== undefined) {
    insertPayload.status = body.status;
  }

  if (body.metaDescription !== undefined) {
    insertPayload.metaDescription = body.metaDescription;
  }

  if (body.deadline) {
    insertPayload.deadline = new Date(body.deadline);
  }

  if (body.notes !== undefined) {
    insertPayload.notes = body.notes;
  }

  if (body.partsCompleted !== undefined) {
    insertPayload.partsCompleted = body.partsCompleted;
  }

  if (body.data !== undefined) {
    insertPayload.data = body.data;
  }

  if (body.sortOrder !== undefined) {
    insertPayload.sortOrder = body.sortOrder;
  } else {
    const parentId = body.parentId ?? null;
    const sortResult = await db.execute<{ max_sort: number }>(
      sql`SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort FROM nodes WHERE parent_id IS NOT DISTINCT FROM ${parentId}`,
    );

    const nextSortOrder = Number(sortResult[0]?.max_sort ?? -1) + 1;
    insertPayload.sortOrder = nextSortOrder;
  }

  const [created] = await db
    .insert(nodes)
    .values(insertPayload as typeof nodes.$inferInsert)
    .returning({
      id: nodes.id,
      name: nodes.name,
      parentId: nodes.parentId,
      isTask: nodes.isTask,
      status: nodes.status,
      path: nodes.path,
      sortOrder: nodes.sortOrder,
      deadline: nodes.deadline,
      createdAt: nodes.createdAt,
      updatedAt: nodes.updatedAt,
    });

  return res.status(201).json({ data: created });
});

export const updateNode = catchAsync(async (req: Request, res) => {
  const body = req.body as UpdateNodeInput;
  const id = Number(req.params.id);
  const userId = req.user!.id;

  const updatePayload: Partial<typeof nodes.$inferInsert> = {};


  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    updatePayload.name = body.name;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    updatePayload.status = body.status;
    if (body.status === 'archived') {
      updatePayload.updatedAt = new Date();
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'metaDescription')) {
    updatePayload.metaDescription = body.metaDescription ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'deadline')) {
    updatePayload.deadline = body.deadline === null ? null : body.deadline ? new Date(body.deadline) : undefined;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
    updatePayload.notes = body.notes ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'partsCompleted')) {
    updatePayload.partsCompleted = body.partsCompleted;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'data')) {
    updatePayload.data = body.data;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'sortOrder')) {
    updatePayload.sortOrder = body.sortOrder;
  }

  const filteredPayload = Object.fromEntries(
    Object.entries(updatePayload).filter(([, value]) => value !== undefined),
  ) as typeof updatePayload;

  const [updated] = await db
    .update(nodes)
    .set(filteredPayload)
    .where(and(eq(nodes.id, id), eq(nodes.userId, userId)))
    .returning();


  if (!updated) {
    throw new AppError('Node not found', 404);
  }

  // Auto-sync to Daily Quest if deadline is being set and node is a task
  if (updated.isTask && Object.prototype.hasOwnProperty.call(body, 'deadline') && body.deadline) {
    try {
      console.log('[Backend] Auto-syncing task to Daily Quest:', { id: updated.id, name: updated.name });
      const userEmail = req.user!.email;
      await syncTaskToDailyQuest({ node: updated, userEmail });
      console.log('[Backend] Successfully synced to Daily Quest');
    } catch (err) {
      console.error('[Backend] Failed to sync to Daily Quest:', err);
      // Don't fail the request if Daily Quest sync fails
    }
  }

  // If name or metaDescription changed, update Daily Quest item ONLY if it already exists
  const shouldConditionalUpdate =
    Object.prototype.hasOwnProperty.call(body, 'name') ||
    Object.prototype.hasOwnProperty.call(body, 'metaDescription');

  if (shouldConditionalUpdate) {
    try {
      const userEmail = req.user!.email;
      await updateTaskInDailyQuestIfExists({ node: updated, userEmail });
    } catch (err) {
      console.warn('[Backend] Daily Quest conditional update failed:', err);
    }
  }

  // Upward status propagation: after changing current node status/force-complete,
  // recompute ancestors until no change occurs or root reached.
  try {
    const statusChanged = Object.prototype.hasOwnProperty.call(body, 'status') || Object.prototype.hasOwnProperty.call(body, 'forceCompleted');
    if (statusChanged) {
      // If forceCompleted was toggled, update current project's status first
      if (Object.prototype.hasOwnProperty.call(body, 'forceCompleted')) {
        const isForced = (body as any).forceCompleted === true;
        if (isForced) {
          // Mark current module done immediately
          await db.update(nodes).set({ status: 'done', updatedAt: new Date() }).where(and(eq(nodes.id, id), eq(nodes.userId, userId)));
          updated.status = 'done';
        } else {
          // Recompute current project from its children when un-forcing
          const children = await db.select({ status: nodes.status }).from(nodes).where(and(eq(nodes.parentId, id), eq(nodes.userId, userId)));
          let newStatus = updated.status;
          if (children.length === 0) {
            newStatus = 'todo';
          } else {
            // Include archived children per requirement
            const anyInProgress = children.some(c => c.status === 'in_progress');
            const allDone = children.every(c => c.status === 'done');
            if (anyInProgress) newStatus = 'in_progress';
            else if (allDone) newStatus = 'done';
            else newStatus = 'todo';
          }
          if (newStatus !== updated.status) {
            await db.update(nodes).set({ status: newStatus, updatedAt: new Date() }).where(and(eq(nodes.id, id), eq(nodes.userId, userId)));
            updated.status = newStatus;
          }
        }
      }

      // Walk up ancestors: recompute starting from the direct parent upward
      const parentId = updated.parentId;
      if (parentId != null) {
        let changed = true;
        let ancestorId: number | null = parentId;
        while (changed && ancestorId != null) {
          // Compute derived status for this ancestor
          const [ancestor] = await db.select().from(nodes).where(and(eq(nodes.id, ancestorId), eq(nodes.userId, userId)));
          if (!ancestor) break;

          // If forceCompleted on ancestor, it stays done
          const isForced = (ancestor as any).forceCompleted === true || (ancestor as any).force_completed === true;
          let newStatus = ancestor.status;
          if (isForced) {
            newStatus = 'done';
          } else {
            // Derive from immediate children including archived (per requirement not to ignore)
            const children = await db.select({ status: nodes.status }).from(nodes).where(and(eq(nodes.parentId, ancestorId), eq(nodes.userId, userId)));
            if (children.length === 0) {
              newStatus = 'todo';
            } else {
              const anyInProgress = children.some(c => c.status === 'in_progress');
              const allDone = children.every(c => c.status === 'done');
              if (anyInProgress) newStatus = 'in_progress';
              else if (allDone) newStatus = 'done';
              else newStatus = 'todo';
            }
          }

          if (newStatus !== ancestor.status) {
            await db.update(nodes).set({ status: newStatus, updatedAt: new Date() }).where(and(eq(nodes.id, ancestorId), eq(nodes.userId, userId)));
            // Move up to this ancestor's parent
            ancestorId = ancestor.parentId ?? null;
            changed = true;
          } else {
            // No change; stop propagation
            changed = false;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Backend] Upward status propagation failed:', e);
  }

  return res.json({ 
    data: {
      id: updated.id,
      name: updated.name,
      parentId: updated.parentId,
      isTask: updated.isTask,
      status: updated.status,
      path: updated.path,
      sortOrder: updated.sortOrder,
      deadline: updated.deadline,
      updatedAt: updated.updatedAt,
    }
  });
});

export const reorderNodes = catchAsync(async (req: Request, res) => {
  const body = req.body as ReorderNodesInput;
  const parentId = body.parentId ?? null;
  const userId = req.user!.id;

  console.log('[Backend] reorderNodes called:', {
    parentId,
    orderedIds: body.orderedIds,
    timestamp: new Date().toISOString(),

  });

  try {
    await db.transaction(async (tx) => {
      if (body.orderedIds.length === 0) {
        return;
      }

      const siblings = await tx.execute<{ id: number }>(sql`
        SELECT id
        FROM nodes
        WHERE parent_id IS NOT DISTINCT FROM ${parentId}
        AND user_id = ${userId}
        ORDER BY sort_order ASC
        FOR UPDATE
      `);


      if (siblings.length !== body.orderedIds.length) {
        throw new AppError('Reorder payload does not cover all siblings', 400);
      }

      const tempOffset = siblings.length + 10;

      for (let index = 0; index < body.orderedIds.length; index += 1) {
        const nodeId = body.orderedIds[index];
        const result = await tx.execute<{ id: number }>(sql`
          UPDATE nodes
          SET sort_order = ${index + tempOffset}, updated_at = NOW()
          WHERE id = ${nodeId}
            AND parent_id IS NOT DISTINCT FROM ${parentId}
            AND user_id = ${userId}
          RETURNING id
        `);


        if (result.length === 0) {
          throw new AppError(`Node ${nodeId} not found under parent`, 404);
        }
      }

      for (let index = 0; index < body.orderedIds.length; index += 1) {
        const nodeId = body.orderedIds[index];
        await tx.execute(sql`
          UPDATE nodes
          SET sort_order = ${index}, updated_at = NOW()
          WHERE id = ${nodeId}
            AND parent_id IS NOT DISTINCT FROM ${parentId}
            AND user_id = ${userId}
        `);

      }
    });

    console.log('[Backend] reorderNodes success');
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[Backend] reorderNodes error:', error);
    throw error;
  }
});

export const moveNode = catchAsync(async (req: Request, res) => {
  const body = req.body as MoveNodeInput;
  const nodeId = body.nodeId;
  const targetParentId = body.newParentId ?? null;
  const userId = req.user!.id;

  await db.transaction(async (tx) => {
    const [nodeToMove] = await tx.select().from(nodes).where(and(eq(nodes.id, nodeId), eq(nodes.userId, userId)));
    if (!nodeToMove) {
      throw new AppError('Node not found', 404);
    }


    const oldPath = nodeToMove.path;
    const oldParentId = nodeToMove.parentId ?? null;
    let newPath: string;
    let newSortOrder: number;

    if (targetParentId === null) {
      // Move to root
      newPath = String(nodeId);
    } else {
      const [parentNode] = await tx.select().from(nodes).where(and(eq(nodes.id, targetParentId), eq(nodes.userId, userId)));
      if (!parentNode) {
        throw new AppError('Parent node not found', 404);
      }

      if (parentNode.isTask) {
        throw new AppError('Cannot move under a task', 400);
      }
      // Prevent moving under own descendant
      if (parentNode.path === oldPath || parentNode.path.startsWith(`${oldPath}.`)) {
        throw new AppError('Cannot move a node under its own descendant', 400);
      }

      newPath = `${parentNode.path}.${nodeId}`;
    }

    const sortResult = await tx.execute<{ max_sort: number }>(
      sql`SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort FROM nodes WHERE parent_id IS NOT DISTINCT FROM ${targetParentId} AND user_id = ${userId}`
    );

    newSortOrder = Number(sortResult[0]?.max_sort ?? -1) + 1;

    await tx
      .update(nodes)
      .set({
        parentId: targetParentId,
        path: newPath,
        sortOrder: newSortOrder,
        updatedAt: new Date(),
      })
      .where(and(eq(nodes.id, nodeId), eq(nodes.userId, userId)));

    const descendants = await tx.execute<{ id: number; path: string }>(
      sql`SELECT id, path::text AS path FROM nodes WHERE path <@ ${oldPath}::ltree AND id <> ${nodeId} AND user_id = ${userId}`
    );


    for (const descendant of descendants) {
      const relative = descendant.path.startsWith(`${oldPath}.`)
        ? descendant.path.slice(oldPath.length + 1)
        : '';
      const descendantPath = relative ? `${newPath}.${relative}` : newPath;

      await tx
        .update(nodes)
        .set({ path: descendantPath, updatedAt: new Date() })
        .where(and(eq(nodes.id, descendant.id), eq(nodes.userId, userId)));
    }

    // Re-sequence sort order for the old parent to close any gaps
    if (oldParentId !== targetParentId) {
      const siblings = await tx.execute<{ id: number }>(
        sql`SELECT id FROM nodes WHERE parent_id IS NOT DISTINCT FROM ${oldParentId} AND user_id = ${userId} ORDER BY sort_order ASC`
      );

      for (let index = 0; index < siblings.length; index += 1) {
        const siblingId = siblings[index]?.id;
        if (!siblingId || siblingId === nodeId) continue;
        await tx
          .update(nodes)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(and(eq(nodes.id, siblingId), eq(nodes.userId, userId)));
      }
    }

  });

  return res.status(200).json({ status: 'ok' });
});

export const deleteNode = catchAsync(async (req: Request, res) => {
  const nodeId = Number(req.params.id);
  const userId = req.user!.id;
  const userEmail = req.user!.email;

  if (Number.isNaN(nodeId)) {
    throw new AppError('Invalid node ID', 400);
  }

  // Collect IDs to delete for Daily Quest cascade before removing locally
  let idsToDelete: number[] = [];

  await db.transaction(async (tx) => {
    // Verify ownership
    const [node] = await tx.select().from(nodes).where(and(eq(nodes.id, nodeId), eq(nodes.userId, userId)));
    if (!node) {
      throw new AppError('Node not found', 404);
    }

    const [nodeToDelete] = await tx.select().from(nodes).where(eq(nodes.id, nodeId));
    if (!nodeToDelete) {
      throw new AppError('Node not found', 404);
    }

    const nodePath = nodeToDelete.path;

    // Gather all node IDs under this path (including root)
    const idRows = await tx.execute<{ id: number }>(
      sql`SELECT id FROM nodes WHERE path <@ ${nodePath}::ltree`
    );
    idsToDelete = idRows.map(r => Number(r.id));

    // Delete the node and all its descendants using path matching
    await tx.execute(
      sql`DELETE FROM nodes WHERE path <@ ${nodePath}::ltree`
    );

    // Re-sequence sort order for siblings to close gaps
    const parentId = nodeToDelete.parentId ?? null;
    const siblings = await tx.execute<{ id: number }>(
      sql`SELECT id FROM nodes WHERE parent_id IS NOT DISTINCT FROM ${parentId} ORDER BY sort_order ASC`
    );

    for (let index = 0; index < siblings.length; index += 1) {
      const siblingId = siblings[index]?.id;
      if (!siblingId) continue;
      await tx
        .update(nodes)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(nodes.id, siblingId));
    }
  });

  // Best-effort: delete corresponding items from Daily Quest
  try {
    if (idsToDelete.length > 0) {
      await deleteNodesFromDailyQuest(idsToDelete, userEmail);
    }
  } catch (err) {
    console.warn('[Backend] Daily Quest cascade delete failed:', err);
  }

  return res.status(200).json({ status: 'ok', message: 'Node deleted successfully' });
});
