
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

let activeSellers = {};

io.on('connection', (socket) => {
  console.log(`✅ User Connected: ${socket.id}`);

  socket.on('seller-go-live', ({ streamId, sellerName }) => {
    activeSellers[streamId] = {
      streamId: streamId,
      socketId: socket.id,
      sellerName: sellerName,
      buyers: 0
    };
    io.emit('sellers-update', Object.values(activeSellers));
    console.log(`🔴 Seller Live: ${sellerName} (${streamId})`);
  });

  socket.on('get-sellers', () => {
    socket.emit('sellers-update', Object.values(activeSellers));
  });

  socket.on('buyer-join-stream', ({ streamId }) => {
    if (activeSellers[streamId]) {
      activeSellers[streamId].buyers++;
      const sellerSocketId = activeSellers[streamId].socketId;
      io.to(sellerSocketId).emit('buyer-joined', { buyerSocketId: socket.id });
      io.emit('sellers-update', Object.values(activeSellers));
    }
  });
  
  socket.on('buyer-leave-stream', ({ streamId }) => {
    if (activeSellers[streamId] && activeSellers[streamId].buyers > 0) {
      activeSellers[streamId].buyers--;
      io.emit('sellers-update', Object.values(activeSellers));
    }
  });

  socket.on('seller-stop-live', ({ streamId }) => {
    if (activeSellers[streamId]) {
      delete activeSellers[streamId];
      io.emit('sellers-update', Object.values(activeSellers));
      io.emit('seller-offline', { streamId });
      console.log(`⚫ Seller Stopped: ${streamId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    for (const streamId in activeSellers) {
      if (activeSellers[streamId].socketId === socket.id) {
        delete activeSellers[streamId];
        io.emit('sellers-update', Object.values(activeSellers));
        io.emit('seller-offline', { streamId }); // Inform viewers the stream ended
        console.log(`⚫ Seller Disconnected & Stopped: ${streamId}`);
        break;
      }
    }
  });

  // --- WebRTC Signaling ---
  socket.on('offer', (data) => {
    io.to(data.to).emit('offer', { from: socket.id, offer: data.offer });
  });
  socket.on('answer', (data) => {
    io.to(data.to).emit('answer', { from: socket.id, answer: data.answer });
  });
  socket.on('ice-candidate', (data) => {
    io.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
  });
});

server.listen(5000, () => {
  console.log('🚀 Live Streaming Server is running on port 5000');
});
