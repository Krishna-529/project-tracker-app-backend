import { Router } from 'express';

import {
  createNode,
  getNodeById,
  getNodeTree,
  reorderNodes,
  moveNode,
  updateNode,
} from '../controllers/nodeController';
import { validateRequest } from '../middleware/validateRequest';
import {
  createNodeSchema,
  getNodeByIdSchema,
  reorderNodesSchema,
  moveNodeSchema,
  updateNodeSchema,
} from '../validators/nodeSchemas';

const router = Router();

router.get('/tree', getNodeTree);
router.post('/reorder', validateRequest(reorderNodesSchema), reorderNodes);
router.post('/move', validateRequest(moveNodeSchema), moveNode);
router.get('/:id', validateRequest(getNodeByIdSchema), getNodeById);
router.post('/', validateRequest(createNodeSchema), createNode);
router.patch('/:id', validateRequest(updateNodeSchema), updateNode);

export const nodeRoutes = router;
