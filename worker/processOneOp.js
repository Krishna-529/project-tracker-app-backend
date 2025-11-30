// worker/processOneOp.js
const pool = require('../db'); // Existing pg Pool instance
const { broadcastFinalOrder } = require('../server/broadcast');
const { applyReorder } = require('./applyReorder'); // Existing business logic helper

async function enqueueReorderOp({ opId, listId, payload }) {
  // Idempotent enqueue: duplicate op_ids are ignored
  await pool.query(
    `INSERT INTO reorder_ops (op_id, list_id, payload, status)
     VALUES ($1, $2, $3, 'pending')
     ON CONFLICT (op_id) DO NOTHING`,
    [opId, listId, payload],
  );
}

async function processOneOp() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `
      WITH next_op AS (
        SELECT id, op_id, list_id, payload
        FROM reorder_ops
        WHERE status = 'pending'
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE reorder_ops ro
      SET status = 'processing', started_at = NOW()
      FROM next_op
      WHERE ro.id = next_op.id
      RETURNING ro.id, ro.op_id, ro.list_id, ro.payload;
      `,
    );

    if (rows.length === 0) {
      await client.query('COMMIT');
      return false; // Nothing to do
    }

    const op = rows[0];

    if (!op) {
      await client.query('COMMIT');
      return false;
    }

    await applyReorder(client, op.list_id, op.payload);

    const { rows: versionRows } = await client.query(
      `
      UPDATE list_meta
      SET order_version = order_version + 1,
          updated_at = NOW()
      WHERE list_id = $1
      RETURNING order_version;
      `,
      [op.list_id],
    );

    const version = versionRows[0].order_version;

    await client.query(
      `UPDATE reorder_ops
       SET status = 'done', completed_at = NOW()
       WHERE id = $1`,
      [op.id],
    );

    await client.query('COMMIT');

    const { rows: pendingRows } = await pool.query(
      `
      SELECT COUNT(*)::INT AS remaining
      FROM reorder_ops
      WHERE list_id = $1
        AND status IN ('pending', 'processing');
      `,
      [op.list_id],
    );

    if (pendingRows[0].remaining === 0) {
      const { rows: orderRows } = await pool.query(
        `
        SELECT item_id
        FROM list_items
        WHERE list_id = $1
        ORDER BY position ASC;
        `,
        [op.list_id],
      );

      const order = orderRows.map(row => row.item_id);
      broadcastFinalOrder(op.list_id, order, version);
    }

    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  enqueueReorderOp,
  processOneOp,
};
