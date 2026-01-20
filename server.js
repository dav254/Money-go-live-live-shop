
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Be careful with this in production
    methods: ["GET", "POST"]
  }
});

let activeSellers = {}; // Store seller data keyed by streamId

io.on('connection', (socket) => {
  console.log(`✅ User Connected: ${socket.id}`);

  // When a seller goes live
  socket.on('seller-go-live', ({ streamId, sellerName }) => {
    activeSellers[streamId] = {
      streamId: streamId,
      socketId: socket.id,
      sellerName: sellerName,
      buyers: 0
    };
    // Let everyone know about the new list of sellers
    io.emit('sellers-update', Object.values(activeSellers));
    console.log(`🔴 Seller Live: ${sellerName} (${streamId})`);
  });

  // When a buyer first loads the page, send them the current list
  socket.on('get-sellers', () => {
    socket.emit('sellers-update', Object.values(activeSellers));
  });

  // When a buyer joins a stream
  socket.on('buyer-join-stream', (data) => {
    const streamId = data.streamId;
    if (activeSellers[streamId]) {
      activeSellers[streamId].buyers = (activeSellers[streamId].buyers || 0) + 1;
      const sellerSocketId = activeSellers[streamId].socketId;
      // Notify the seller that a new buyer has joined
      io.to(sellerSocketId).emit('buyer-joined', { buyerSocketId: socket.id, viewerCount: activeSellers[streamId].buyers });
      // Update everyone on the new viewer count
      io.emit('sellers-update', Object.values(activeSellers));
    }
  });
  
  // When a buyer leaves a stream
  socket.on('buyer-leave-stream', (data) => {
    const streamId = data.streamId;
    if (activeSellers[streamId] && activeSellers[streamId].buyers > 0) {
      activeSellers[streamId].buyers--;
      // Update everyone on the new viewer count
      io.emit('sellers-update', Object.values(activeSellers));
    }
  });

  // When a seller stops the stream
  socket.on('seller-stop-live', ({ streamId }) => {
    if (activeSellers[streamId]) {
      delete activeSellers[streamId];
      // Let everyone know a seller has left
      io.emit('sellers-update', Object.values(activeSellers));
      console.log(`⚫ Seller Stopped: ${streamId}`);
    }
  });

  // When any user disconnects
  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    // Check if the disconnected user was a seller
    for (const streamId in activeSellers) {
      if (activeSellers[streamId].socketId === socket.id) {
        delete activeSellers[streamId];
        // Let everyone know a seller has left
        io.emit('sellers-update', Object.values(activeSellers));
        console.log(`⚫ Seller Disconnected & Stopped: ${streamId}`);
        break;
      }
    }
  });

  // WebRTC Signaling
  socket.on('offer', (data) => { io.to(data.to).emit('offer', { from: socket.id, offer: data.offer }); });
  socket.on('answer', (data) => { io.to(data.to).emit('answer', { from: socket.id, answer: data.answer }); });
  socket.on('ice-candidate', (data) => { io.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate }); });
});

server.listen(5000, () => {
  console.log('🚀 Live Streaming Server is running on port 5000');
});
