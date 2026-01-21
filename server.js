
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
    console.log(`🎬 Seller ${sellerName} (${streamId}) going live`);
    activeSellers[streamId] = {
      streamId: streamId,
      socketId: socket.id,
      sellerName: sellerName,
      buyers: 0
    };
    io.emit('sellers-update', Object.values(activeSellers));
    console.log(`🔴 Active sellers:`, Object.keys(activeSellers));
  });

  socket.on('get-sellers', () => {
    socket.emit('sellers-update', Object.values(activeSellers));
  });

  socket.on('buyer-join-stream', ({ streamId }) => {
    console.log(`👀 Buyer ${socket.id} wants to join stream ${streamId}`);
    
    if (activeSellers[streamId]) {
      activeSellers[streamId].buyers++;
      const sellerSocketId = activeSellers[streamId].socketId;
      
      console.log(`🔗 Connecting buyer ${socket.id} to seller ${sellerSocketId}`);
      
      io.to(sellerSocketId).emit('buyer-joined', { 
        buyerSocketId: socket.id,
        streamId: streamId
      });
      
      io.emit('sellers-update', Object.values(activeSellers));
      
      console.log(`✅ Buyer ${socket.id} joined stream ${streamId}`);
    } else {
      console.log(`❌ Stream ${streamId} not found for buyer ${socket.id}`);
      socket.emit('stream-not-found', { streamId });
    }
  });
  
  socket.on('buyer-leave-stream', ({ streamId }) => {
    if (activeSellers[streamId] && activeSellers[streamId].buyers > 0) {
      activeSellers[streamId].buyers--;
      io.emit('sellers-update', Object.values(activeSellers));
      console.log(`👋 Buyer ${socket.id} left stream ${streamId}`);
    }
  });

  socket.on('seller-stop-live', ({ streamId }) => {
    console.log(`⏹️ Seller stopping stream ${streamId}`);
    if (activeSellers[streamId]) {
      delete activeSellers[streamId];
      io.emit('sellers-update', Object.values(activeSellers));
      io.emit('seller-offline', { streamId });
      console.log(`⚫ Stream ${streamId} removed`);
    }
  });

  // --- WebRTC Signaling ---
  socket.on('offer', (data) => {
    console.log(`📤 Offer from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('offer', { 
      from: socket.id, 
      offer: data.offer 
    });
  });
  
  socket.on('answer', (data) => {
    console.log(`📥 Answer from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('answer', { 
      from: socket.id, 
      answer: data.answer 
    });
  });
  
  socket.on('ice-candidate', (data) => {
    console.log(`🧊 ICE candidate from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('ice-candidate', { 
      from: socket.id, 
      candidate: data.candidate 
    });
  });

  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    for (const streamId in activeSellers) {
      if (activeSellers[streamId].socketId === socket.id) {
        console.log(`⚫ Seller ${streamId} disconnected`);
        delete activeSellers[streamId];
        io.emit('sellers-update', Object.values(activeSellers));
        io.emit('seller-offline', { streamId });
        break;
      }
    }
  });

  // Debug endpoint
  socket.on('debug-info', () => {
    console.log('=== DEBUG INFO ===');
    console.log('Active sellers:', activeSellers);
    console.log('Socket connections:', io.engine.clientsCount);
    socket.emit('debug-response', {
      sellers: activeSellers,
      connections: io.engine.clientsCount
    });
  });
});

server.listen(5000, () => {
  console.log('🚀 Live Streaming Server is running on port 5000');
});
