const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());

let activeSellers = {};

io.on('connection', (socket) => {
  console.log('✅ New Connection:', socket.id);

  socket.on('seller-go-live', (data) => {
    console.log(`🔴 Seller is live: ${data.sellerName} (${data.streamId})`);
    activeSellers[data.streamId] = {
      streamId: data.streamId,
      socketId: socket.id,
      sellerName: data.sellerName,
      buyers: {}, // Use an object to store buyer sockets
    };
    // Inform all clients that a new seller is live
    io.emit('sellers-update', Object.values(activeSellers));
  });

  socket.on('get-sellers', () => {
    socket.emit('sellers-update', Object.values(activeSellers));
  });

  socket.on('buyer-join-stream', (data) => {
    const seller = activeSellers[data.streamId];
    if (seller) {
      seller.buyers[socket.id] = true;
      const viewerCount = Object.keys(seller.buyers).length;
      console.log(`👁️ Buyer joined ${seller.streamId}. Viewers: ${viewerCount}`);
      // Notify seller of the new buyer
      io.to(seller.socketId).emit('buyer-joined', { buyerSocketId: socket.id, viewerCount });
      // Update everyone on the new viewer count
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
    // Forward the ICE candidate to the correct peer
    const recipientSocketId = data.to;
    if(recipientSocketId) {
        io.to(recipientSocketId).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
    }
  });

  const cleanupStream = (socketId) => {
     let streamIdToDelete = null;
    for (const streamId in activeSellers) {
      if (activeSellers[streamId].socketId === socketId) {
        streamIdToDelete = streamId;
        break;
      }
      if (activeSellers[streamId].buyers[socketId]) {
          delete activeSellers[streamId].buyers[socketId];
          const viewerCount = Object.keys(activeSellers[streamId].buyers).length;
          console.log(`👋 Buyer left ${streamId}. Viewers: ${viewerCount}`);
          io.to(activeSellers[streamId].socketId).emit('buyer-left', { viewerCount });
          io.emit('sellers-update', Object.values(activeSellers));
          break;
      }
    }
    
    if (streamIdToDelete) {
        console.log(`⏹️ Seller stopped stream: ${streamIdToDelete}`);
        delete activeSellers[streamIdToDelete];
        io.emit('sellers-update', Object.values(activeSellers));
        io.emit('stream-ended', { streamId: streamIdToDelete });
    }
  }

  socket.on('seller-stop-live', () => cleanupStream(socket.id));
  socket.on('buyer-leave-stream', () => cleanupStream(socket.id));
  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    cleanupStream(socket.id);
  });
});

server.listen(5000, () => {
  console.log('🚀 Live streaming server is running on port 5000');
});
