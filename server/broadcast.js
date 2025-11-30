// server/broadcast.js
const { clientsByList } = require('./ws'); // Existing ws registry

function broadcastFinalOrder(listId, order, version) {
  const payload = JSON.stringify({
    type: 'final_order',
    listId,
    order,
    version,
  });

  const subscribers = clientsByList.get(String(listId));
  if (!subscribers) return;

  for (const socket of subscribers) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

module.exports = { broadcastFinalOrder };
