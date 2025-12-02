import type { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { catchAsync } from '../utils/catchAsync';
import { syncTaskToDailyQuest } from '../services/dailyQuestService';
import { db } from '../db';
import { nodes } from '../db/schema';
import { AppError } from '../errors/AppError';

export const sendToDailyQuest = catchAsync(async (req: Request, res: Response) => {
  const nodeId = Number(req.params.nodeId);
  const userId = req.user!.id;
  const userEmail = req.user!.email;

  console.log('[Integration] Send to Daily Quest request:', { nodeId, userId, userEmail });

  // Fetch the node
  const node = await db.query.nodes.findFirst({
    where: and(eq(nodes.id, nodeId), eq(nodes.userId, userId)),
  });

  if (!node) {
    throw new AppError('Node not found', 404);
  }

  console.log('[Integration] Node found:', { 
    id: node.id, 
    name: node.name, 
    isTask: node.isTask,
  });

  // Sync to Daily Quest (supports both tasks and projects)
  const result = await syncTaskToDailyQuest({ node, userEmail });

  const itemType = node.isTask ? 'Task' : 'Project';
  
  res.status(200).json({
    status: 'success',
    data: result,
    message: `${itemType} ${result.action} in Daily Quest`,
  });
});
