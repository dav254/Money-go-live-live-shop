
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());

let activeSellers = {};
let buyerCounts = {};

io.on('connection', (socket) => {
  console.log('✅ Connected:', socket.id);

  socket.on('seller-go-live', (data) => {
    activeSellers[data.streamId] = {
      streamId: data.streamId,
      socketId: socket.id,
      sellerName: data.sellerName,
      buyers: 0
    };
    buyerCounts[data.streamId] = 0;

    io.emit('sellers-update', Object.values(activeSellers));
    console.log(`🔴 Seller live: ${data.sellerName}`);
  });

  socket.on('get-sellers', () => {
    socket.emit('sellers-update', Object.values(activeSellers));
  });

  socket.on('buyer-join-stream', (data) => {
    const sellerSocketId = activeSellers[data.streamId]?.socketId;
    
    if (sellerSocketId) {
      buyerCounts[data.streamId] = (buyerCounts[data.streamId] || 0) + 1;
      activeSellers[data.streamId].buyers = buyerCounts[data.streamId];

      io.to(sellerSocketId).emit('buyer-joined', { 
        buyerSocketId: socket.id,
        viewerCount: buyerCounts[data.streamId]
      });

      io.emit('sellers-update', Object.values(activeSellers));
    }
  });

  socket.on('buyer-leave-stream', (data) => {
    const streamId = data.streamId;
    if (buyerCounts[streamId] > 0) {
      buyerCounts[streamId]--;
      if (activeSellers[streamId]) {
        activeSellers[streamId].buyers = buyerCounts[streamId];
      }
      io.emit('sellers-update', Object.values(activeSellers));
    }
  });

  socket.on('offer', (data) => {
    io.to(data.to).emit('offer', { from: socket.id, offer: data.offer });
  });

  socket.on('answer', (data) => {
    io.to(data.to).emit('answer', { from: socket.id, answer: data.answer });
  });

  socket.on('ice-candidate', (data) => {
    io.to(data.to).emit('ice-candidate', { 
      from: socket.id, 
      candidate: data.candidate 
    });
  });

  socket.on('seller-stop-live', (data) => {
    const streamId = data.streamId;
    if (activeSellers[streamId]) {
      delete activeSellers[streamId];
      delete buyerCounts[streamId];
      io.emit('sellers-update', Object.values(activeSellers));
      io.emit('seller-offline');
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    for (let streamId in activeSellers) {
      if (activeSellers[streamId].socketId === socket.id) {
        delete activeSellers[streamId];
        delete buyerCounts[streamId];
        io.emit('sellers-update', Object.values(activeSellers));
        io.emit('seller-offline');
      }
    }
  });
});

server.listen(5000, () => {
  console.log('🚀 Server running on port 5000');
});
