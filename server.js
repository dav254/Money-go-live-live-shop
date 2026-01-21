
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

  // Seller goes live
  socket.on('seller-go-live', ({ streamId, sellerName, sellerUid }) => {
    console.log(`🎬 ${sellerName} starting stream: ${streamId}`);
    
    activeSellers[streamId] = {
      streamId: streamId,
      socketId: socket.id,
      sellerName: sellerName,
      sellerUid: sellerUid,
      buyers: 0,
      createdAt: new Date().toISOString()
    };
    
    // Broadcast to ALL connected clients
    io.emit('sellers-update', Object.values(activeSellers));
    console.log(`🔴 Active streams:`, Object.keys(activeSellers));
  });

  // Get current sellers
  socket.on('get-sellers', () => {
    console.log(`📋 Sending sellers list to ${socket.id}`);
    socket.emit('sellers-update', Object.values(activeSellers));
  });

  // Buyer joins stream
  socket.on('buyer-join-stream', ({ streamId }) => {
    console.log(`👀 Buyer ${socket.id} joining stream ${streamId}`);
    
    if (activeSellers[streamId]) {
      activeSellers[streamId].buyers++;
      
      // Notify the specific seller
      const sellerSocketId = activeSellers[streamId].socketId;
      io.to(sellerSocketId).emit('buyer-joined', { 
        buyerSocketId: socket.id,
        streamId: streamId
      });
      
      // Broadcast updated viewer count to ALL
      io.emit('sellers-update', Object.values(activeSellers));
      
      console.log(`✅ Buyer ${socket.id} joined ${streamId}`);
    } else {
      console.log(`❌ Stream ${streamId} not found`);
      socket.emit('stream-not-found', { streamId });
    }
  });
  
  // Buyer leaves stream
  socket.on('buyer-leave-stream', ({ streamId }) => {
    if (activeSellers[streamId] && activeSellers[streamId].buyers > 0) {
      activeSellers[streamId].buyers--;
      io.emit('sellers-update', Object.values(activeSellers));
      console.log(`👋 Buyer left ${streamId}`);
    }
  });

  // Seller stops stream
  socket.on('seller-stop-live', ({ streamId }) => {
    console.log(`⏹️ Stopping stream ${streamId}`);
    if (activeSellers[streamId]) {
      delete activeSellers[streamId];
      io.emit('sellers-update', Object.values(activeSellers));
      io.emit('seller-offline', { streamId });
    }
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    io.to(data.to).emit('offer', { 
      from: socket.id, 
      offer: data.offer 
    });
  });
  
  socket.on('answer', (data) => {
    io.to(data.to).emit('answer', { 
      from: socket.id, 
      answer: data.answer 
    });
  });
  
  socket.on('ice-candidate', (data) => {
    io.to(data.to).emit('ice-candidate', { 
      from: socket.id, 
      candidate: data.candidate 
    });
  });

  // Disconnection
  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    
    // Remove seller if they disconnect
    for (const streamId in activeSellers) {
      if (activeSellers[streamId].socketId === socket.id) {
        console.log(`⚫ Removing offline seller: ${streamId}`);
        delete activeSellers[streamId];
        io.emit('sellers-update', Object.values(activeSellers));
        io.emit('seller-offline', { streamId });
        break;
      }
    }
  });

  // Auto cleanup: Remove old streams (optional)
  setInterval(() => {
    const now = new Date();
    for (const streamId in activeSellers) {
      const streamTime = new Date(activeSellers[streamId].createdAt);
      const hoursDiff = (now - streamTime) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) { // Remove streams older than 24 hours
        console.log(`🗑️ Removing old stream: ${streamId}`);
        delete activeSellers[streamId];
        io.emit('sellers-update', Object.values(activeSellers));
      }
    }
  }, 3600000); // Check every hour
});

server.listen(5000, () => {
  console.log('🚀 Live Streaming Server is running on port 5000');
});
