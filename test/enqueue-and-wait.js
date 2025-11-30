// test/enqueue-and-wait.js
const WebSocket = require('ws');
const { enqueueReorderOp } = require('../worker/processOneOp');
const { waitForAllOpsToDrain } = require('../worker/runLoop'); // Existing helper to wait for worker drain

const LIST_ID = 42;
const broadcasts = [];

const ws = new WebSocket('ws://localhost:4000'); // Replace with real host/port

ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  if (msg.type === 'final_order' && msg.listId === LIST_ID) {
    broadcasts.push(msg);
    console.log('final_order broadcast:', msg);
  }
});

ws.on('open', async () => {
  await enqueueReorderOp({ opId: 'op-a', listId: LIST_ID, payload: {/* ... */} });
  await enqueueReorderOp({ opId: 'op-b', listId: LIST_ID, payload: {/* ... */} });
  await enqueueReorderOp({ opId: 'op-c', listId: LIST_ID, payload: {/* ... */} });

  await waitForAllOpsToDrain();

  setTimeout(() => {
    if (broadcasts.length !== 1) {
      console.error(`Expected exactly one final_order broadcast, got ${broadcasts.length}`);
      process.exit(1);
    }

    console.log('Test passed: single final_order broadcast observed.');
    process.exit(0);
  }, 500);
});
