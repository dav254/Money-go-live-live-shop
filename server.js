
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
    methods: ["GET", "POST"],
    transports: ['websocket', 'polling']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

let activeSellers = {};
let socketToStream = {}; // Track which stream each socket is in

io.on('connection', (socket) => {
  console.log(`✅ User Connected: ${socket.id} `);

  // Seller goes live
  socket.on('seller-go-live', ({ streamId, sellerName, sellerUid }) => {
    console.log(`🎬 ${sellerName} starting stream: ${streamId}`);
    
    activeSellers[streamId] = {
      streamId: streamId,
      socketId: socket.id,
      sellerName: sellerName,
      sellerUid: sellerUid,
      buyers: new Set(), // Use Set for unique buyer IDs
      createdAt: new Date().toISOString(),
      sellerSocket: socket.id
    };
    
    // Store stream info for this socket
    socketToStream[socket.id] = { type: 'seller', streamId: streamId };
    
    // Broadcast to ALL connected clients
    io.emit('sellers-update', Object.values(activeSellers).map(s => ({
      ...s,
      buyers: s.buyers.size
    })));
    
    console.log(`🔴 Active streams:`, Object.keys(activeSellers));
  });

  // Get current sellers
  socket.on('get-sellers', () => {
    console.log(`📋 Sending sellers list to ${socket.id}`);
    socket.emit('sellers-update', Object.values(activeSellers).map(s => ({
      ...s,
      buyers: s.buyers.size
    })));
  });

  // Buyer joins stream
  socket.on('buyer-join-stream', ({ streamId }) => {
    console.log(`👀 Buyer ${socket.id} joining stream ${streamId}`);
    
    if (activeSellers[streamId]) {
      activeSellers[streamId].buyers.add(socket.id);
      socketToStream[socket.id] = { type: 'buyer', streamId: streamId };
      
      const sellerSocketId = activeSellers[streamId].socketId;
      io.to(sellerSocketId).emit('buyer-joined', { 
        buyerSocketId: socket.id,
        streamId: streamId
      });
      
      io.emit('sellers-update', Object.values(activeSellers).map(s => ({
        ...s,
        buyers: s.buyers.size
      })));
      
      console.log(`✅ Buyer ${socket.id} joined ${streamId}, total buyers: ${activeSellers[streamId].buyers.size}`);
    } else {
      console.log(`❌ Stream ${streamId} not found`);
      socket.emit('stream-not-found', { streamId });
    }
  });
  
  // Buyer leaves stream
  socket.on('buyer-leave-stream', ({ streamId }) => {
    const stream = activeSellers[streamId];
    if (stream && stream.buyers.has(socket.id)) {
      stream.buyers.delete(socket.id);
      delete socketToStream[socket.id];
      
      io.emit('sellers-update', Object.values(activeSellers).map(s => ({
        ...s,
        buyers: s.buyers.size
      })));
      
      console.log(`👋 Buyer left ${streamId}, remaining: ${stream.buyers.size}`);
    }
  });

  // Seller stops stream
  socket.on('seller-stop-live', ({ streamId }) => {
    console.log(`⏹️ Stopping stream ${streamId}`);
    if (activeSellers[streamId]) {
      activeSellers[streamId].buyers.forEach(buyerSocketId => {
        io.to(buyerSocketId).emit('seller-offline', { streamId });
      });
      
      delete activeSellers[streamId];
      io.emit('sellers-update', Object.values(activeSellers).map(s => ({ ...s, buyers: s.buyers.size })));
      io.emit('seller-offline', { streamId });
    }
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    console.log(`📤 Offer from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('offer', { from: socket.id, offer: data.offer });
  });
  
  socket.on('answer', (data) => {
    console.log(`📥 Answer from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('answer', { from: socket.id, answer: data.answer });
  });
  
  socket.on('ice-candidate', (data) => {
    io.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    
    const streamInfo = socketToStream[socket.id];
    if (!streamInfo) return;

    const { type, streamId } = streamInfo;
    const stream = activeSellers[streamId];

    if (type === 'seller') {
        console.log(`⚫ Removing offline seller: ${streamId}`);
        if(stream) {
            stream.buyers.forEach(buyerSocketId => {
                io.to(buyerSocketId).emit('seller-offline', { streamId });
            });
            delete activeSellers[streamId];
        }
    } else if (type === 'buyer' && stream) {
        stream.buyers.delete(socket.id);
        const sellerSocketId = stream.socketId;
        io.to(sellerSocketId).emit('buyer-left', { buyerSocketId: socket.id });
    }
    
    delete socketToStream[socket.id];
    io.emit('sellers-update', Object.values(activeSellers).map(s => ({ ...s, buyers: s.buyers.size })));
  });

  // Health check
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

setInterval(() => {
  const now = new Date();
  for (const streamId in activeSellers) {
    const streamTime = new Date(activeSellers[streamId].createdAt);
    const hoursDiff = (now - streamTime) / (1000 * 60 * 60);
    
    if (hoursDiff > 6) {
      console.log(`🗑️ Removing old stream: ${streamId}`);
      delete activeSellers[streamId];
      io.emit('sellers-update', Object.values(activeSellers).map(s => ({...s, buyers: s.buyers.size})));
    }
  }
}, 600000);

server.listen(5000, () => {
  console.log('🚀 Live Streaming Server is running on port 5000');
});
