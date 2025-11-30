import { z } from 'zod';

import { nodeStatusEnum } from '../db/schema';

const statusValues = nodeStatusEnum.enumValues;

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

const nullableParentId = z
  .number({ invalid_type_error: 'parentId must be a number or null' })
  .int()
  .positive()
  .nullable()
  .optional();

export const createNodeSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    isTask: z.boolean(),
    parentId: nullableParentId,
    status: z.enum(statusValues).optional(),
    metaDescription: z.string().optional(),
    deadline: z.string().datetime({ offset: true }).optional(),
    notes: z.string().optional(),
    partsCompleted: z.number().int().min(0).optional(),
    data: z.record(z.any()).optional(),
    sortOrder: z.number().int().optional(),
  }),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const updateNodeSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).optional(),
      status: z.enum(statusValues).optional(),
      metaDescription: z.string().nullable().optional(),
      deadline: z.string().datetime({ offset: true }).nullable().optional(),
      notes: z.string().nullable().optional(),
      partsCompleted: z.number().int().min(0).optional(),
      data: z.record(z.any()).optional(),
      sortOrder: z.number().int().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field must be provided for update',
    }),
  params: idParam,
  query: z.object({}).strict(),
});

export const moveNodeSchema = z.object({
  body: z.object({
    nodeId: z.number().int().positive(),
    newParentId: z.number().int().positive().nullable().optional(),
  }),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const reorderNodesSchema = z.object({
  body: z.object({
    parentId: z.number().int().positive().nullable().optional(),
    orderedIds: z.array(z.number().int().positive()).min(1),
  }),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const getNodeByIdSchema = z.object({
  body: z.object({}).strict(),
  params: idParam,
  query: z.object({}).strict(),
});

export type CreateNodeInput = z.infer<typeof createNodeSchema>['body'];
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>['body'];
export type MoveNodeInput = z.infer<typeof moveNodeSchema>['body'];
export type ReorderNodesInput = z.infer<typeof reorderNodesSchema>['body'];
