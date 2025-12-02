import { Router } from 'express';

import {
  createNode,
  deleteNode,
  getNodeById,
  getNodeTree,
  reorderNodes,
  moveNode,
  updateNode,
} from '../controllers/nodeController';
import { validateRequest } from '../middleware/validateRequest';
import { requireAuth } from '../middleware/requireAuth';
import {
  createNodeSchema,
  getNodeByIdSchema,
  reorderNodesSchema,
  moveNodeSchema,
  updateNodeSchema,
} from '../validators/nodeSchemas';
import { fixAllPaths } from '../utils/fixPaths';
import { catchAsync } from '../utils/catchAsync';

const router = Router();

router.use(requireAuth);

router.get('/tree', getNodeTree);

router.post('/reorder', validateRequest(reorderNodesSchema), reorderNodes);
router.post('/move', validateRequest(moveNodeSchema), moveNode);
router.post('/fix-paths', catchAsync(async (req, res) => {
  await fixAllPaths();
  res.json({ status: 'success', message: 'All paths have been fixed' });
}));
router.get('/:id', validateRequest(getNodeByIdSchema), getNodeById);
router.post('/', validateRequest(createNodeSchema), createNode);
router.patch('/:id', validateRequest(updateNodeSchema), updateNode);
router.delete('/:id', deleteNode);

export const nodeRoutes = router;
