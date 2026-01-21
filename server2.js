
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
  }
});

// Keep track of streams and their sellers
const streams = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('seller-go-live', ({ streamId }) => {
    console.log(`Seller ${socket.id} is going live with stream ID: ${streamId}`);
    streams[streamId] = { sellerSocketId: socket.id, buyers: new Set() };
    socket.join(streamId); // Seller joins a room for their stream
  });

  socket.on('buyer-join-stream', ({ streamId }) => {
    const stream = streams[streamId];
    if (stream) {
      console.log(`Buyer ${socket.id} is joining stream: ${streamId}`);
      stream.buyers.add(socket.id);
      socket.join(streamId);

      // Notify the seller that a new buyer has joined
      io.to(stream.sellerSocketId).emit('new-buyer', { buyerSocketId: socket.id });
    } else {
      // Handle case where stream doesn't exist if necessary
      console.log(`Buyer ${socket.id} tried to join a non-existent stream: ${streamId}`);
    }
  });

  // Generic signal routing
  socket.on('signal', (data) => {
    // console.log(`Signal from ${data.from} to ${data.to}`);
    io.to(data.to).emit('signal', { from: data.from, signal: data.signal });
  });

  socket.on('seller-stop-live', ({ streamId }) => {
    console.log(`Seller stopped stream: ${streamId}`);
    // Notify all buyers in the room that the stream has ended
    io.to(streamId).emit('stream-ended');
    delete streams[streamId];
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Find if the disconnected user was a seller or buyer and clean up
    for (const streamId in streams) {
      const stream = streams[streamId];
      if (stream.sellerSocketId === socket.id) {
        console.log(`Seller ${socket.id} disconnected. Ending stream ${streamId}.`);
        io.to(streamId).emit('stream-ended');
        delete streams[streamId];
        break;
      } else if (stream.buyers.has(socket.id)) {
        console.log(`Buyer ${socket.id} disconnected from stream ${streamId}.`);
        stream.buyers.delete(socket.id);
        // Notify the seller that a buyer has left
        io.to(stream.sellerSocketId).emit('buyer-left', { buyerSocketId: socket.id });
        break;
      }
    }
  });
});

server.listen(5001, () => {
  console.log('Signaling server is listening on port 5001');
});
