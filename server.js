
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());

let activeSellers = {}; // streamId -> { streamId, socketId, sellerName, buyers }

io.on('connection', (socket) => {
  console.log('✅ Connected:', socket.id);

  socket.on('seller-go-live', (data) => {
    activeSellers[data.streamId] = {
      streamId: data.streamId,
      socketId: socket.id,
      sellerName: data.sellerName,
      buyers: 0
    };
    io.emit('sellers-update', Object.values(activeSellers));
    console.log(`🔴 Seller live: ${data.sellerName}`);
  });

  socket.on('get-sellers', () => {
    socket.emit('sellers-update', Object.values(activeSellers));
  });

  socket.on('buyer-join-stream', (data) => {
    const seller = activeSellers[data.streamId];
    if (seller) {
      seller.buyers = (seller.buyers || 0) + 1;
      io.to(seller.socketId).emit('buyer-joined', { 
        buyerSocketId: socket.id,
        viewerCount: seller.buyers
      });
      io.emit('sellers-update', Object.values(activeSellers));
    }
  });

  socket.on('buyer-leave-stream', (data) => {
    const seller = activeSellers[data.streamId];
    if (seller && seller.buyers > 0) {
      seller.buyers--;
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
    // If 'to' is specified, send it directly (seller -> buyer)
    if (data.to) {
        io.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
    } else if (data.streamId) {
        // If no 'to' but has streamId, it's a buyer sending to the seller of that stream
        const seller = activeSellers[data.streamId];
        if (seller) {
            io.to(seller.socketId).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
        }
    }
  });

  socket.on('seller-stop-live', (data) => {
    const streamId = data.streamId;
    if (activeSellers[streamId]) {
      delete activeSellers[streamId];
      io.emit('sellers-update', Object.values(activeSellers));
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    let streamIdToDelete = null;
    for (let streamId in activeSellers) {
      if (activeSellers[streamId].socketId === socket.id) {
        streamIdToDelete = streamId;
        break; 
      }
    }
    if (streamIdToDelete) {
        delete activeSellers[streamIdToDelete];
        io.emit('sellers-update', Object.values(activeSellers));
        console.log(`Seller for stream ${streamIdToDelete} disconnected and removed.`);
    }
  });
});

server.listen(5000, () => {
  console.log('🚀 Server running on port 5000');
});
