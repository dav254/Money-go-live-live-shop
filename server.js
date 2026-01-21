const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors({
  origin: "*",
  credentials: true
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Test route
app.get('/', (req, res) => {
  res.json({ 
    status: 'Live Streaming Server is running',
    timestamp: new Date().toISOString(),
    clients: io.engine.clientsCount || 0
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    activeSellers: Object.keys(activeSellers).length
  });
});

let activeSellers = {};
let socketToStream = {};

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
      buyers: new Set(),
      createdAt: new Date().toISOString(),
      sellerSocket: socket.id
    };
    
    // Store stream info
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
      // Add buyer to the stream
      activeSellers[streamId].buyers.add(socket.id);
      socketToStream[socket.id] = { type: 'buyer', streamId: streamId };
      
      // Notify the specific seller
      const sellerSocketId = activeSellers[streamId].socketId;
      io.to(sellerSocketId).emit('buyer-joined', { 
        buyerSocketId: socket.id,
        streamId: streamId
      });
      
      // Broadcast updated viewer count
      io.emit('sellers-update', Object.values(activeSellers).map(s => ({
        ...s,
        buyers: s.buyers.size
      })));
      
      console.log(`✅ Buyer ${socket.id} joined ${streamId}`);
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
      
      // Notify seller
      if (stream.socketId) {
        io.to(stream.socketId).emit('buyer-left', { buyerSocketId: socket.id });
      }
      
      io.emit('sellers-update', Object.values(activeSellers).map(s => ({
        ...s,
        buyers: s.buyers.size
      })));
      
      console.log(`👋 Buyer left ${streamId}`);
    }
  });

  // Seller stops stream
  socket.on('seller-stop-live', ({ streamId }) => {
    console.log(`⏹️ Stopping stream ${streamId}`);
    if (activeSellers[streamId]) {
      // Notify all buyers
      activeSellers[streamId].buyers.forEach(buyerSocketId => {
        io.to(buyerSocketId).emit('seller-offline', { streamId });
      });
      
      delete activeSellers[streamId];
      io.emit('sellers-update', Object.values(activeSellers).map(s => ({
        ...s,
        buyers: s.buyers.size
      })));
      io.emit('seller-offline', { streamId });
    }
  });

  // WebRTC signaling
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

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    
    const streamInfo = socketToStream[socket.id];
    if (streamInfo) {
      const { type, streamId } = streamInfo;
      const stream = activeSellers[streamId];

      if (type === 'seller') {
        console.log(`⚫ Removing offline seller: ${streamId}`);
        if (stream) {
          stream.buyers.forEach(buyerSocketId => {
            io.to(buyerSocketId).emit('seller-offline', { streamId });
          });
          delete activeSellers[streamId];
        }
      } else if (type === 'buyer' && stream) {
        stream.buyers.delete(socket.id);
        if (stream.socketId) {
          io.to(stream.socketId).emit('buyer-left', { buyerSocketId: socket.id });
        }
      }
      
      delete socketToStream[socket.id];
    }
    
    // Update all clients
    io.emit('sellers-update', Object.values(activeSellers).map(s => ({ 
      ...s, 
      buyers: s.buyers.size 
    })));
  });

  // Debug endpoint
  socket.on('debug-info', () => {
    const info = {
      sellers: activeSellers,
      connections: io.engine.clientsCount,
      socketToStream: socketToStream
    };
    socket.emit('debug-response', info);
  });
});

server.listen(5000, '0.0.0.0', () => {
  console.log('🚀 Live Streaming Server is running on port 5000');
  console.log('Server accessible at:');
  console.log('  - http://localhost:5000');
  console.log('  - http://0.0.0.0:5000');
});
