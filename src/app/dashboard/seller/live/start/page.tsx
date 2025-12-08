'use client';

import React, { useEffect, useState } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import LiveControls from '@/components/studio/LiveControls';
import LiveProductBag from '@/components/studio/LiveProductBag';
import api from '@/lib/api';
import { connectLiveSocket, getSocket } from '@/lib/socket';

export default function LiveStudio() {
  const [products, setProducts] = useState([]);
  const [liveRoomId, setLiveRoomId] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    try {
      // const res = await api.get('/api/products?sellerId=ME'); // replace ME with seller id
      // setProducts(res.data || []);
    } catch (err) { console.error(err); }
  }

  async function goLive() {
    try {
    //   const res = await api.post('/api/live/create', { sellerId: 'ME', title: 'Live now' });
    //   setLiveRoomId(res.data.roomId);
    //   // connect socket
    //   const s = connectLiveSocket();
    //   s.emit('join-live', { roomId: res.data.roomId, userId: 'ME', role: 'seller' });
    //   setSocket(s);
      alert('You are now live (frontend side) — wire mediasoup or RTMP to stream.');
    } catch (err) { console.error(err); alert('Failed to create live'); }
  }

  function endLive() {
    if (!liveRoomId) return;
    // api.post('/api/live/end', { roomId: liveRoomId }).then(() => {
    //   socket && socket.emit('leave-live', { roomId: liveRoomId });
    //   setLiveRoomId(null);
    //   alert('Live ended');
    // }).catch(err => console.error(err));
  }

  function addProduct() {
    alert('Open product modal (implement)');
  }

  return (
    <SellerLayout>
      <main className="max-w-7xl mx-auto p-6 grid md:grid-cols-3 gap-6">
        <section className="md:col-span-2 space-y-4">
          <div className="bg-black/70 rounded p-4">
            <h2 className="font-bold mb-2">Live Preview</h2>
            <div className="aspect-video bg-black flex items-center justify-center text-muted-foreground rounded-lg">
                Your live camera feed will appear here.
            </div>
          </div>

          <div className="bg-black/70 rounded p-4">
            <h2 className="font-bold mb-2">Live Controls</h2>
            <LiveControls onGoLive={goLive} onEndLive={endLive} onAddProduct={addProduct} />
            {liveRoomId && <div className="mt-3 text-sm text-red-300">Live Room ID: {liveRoomId}</div>}
          </div>
        </section>

        <aside className="space-y-4">
          <LiveProductBag products={products} onPin={(p)=>{ getSocket()?.emit('pin-product', { roomId: liveRoomId, productId: p._id }); alert('Pinned: ' + p.name); }} />
          <div className="bg-black/70 p-4 rounded">
            <h4 className="font-bold">Analytics (live)</h4>
            <div className="text-sm text-gray-400">Viewers: 0</div>
            <div className="text-sm text-gray-400">Likes: 0</div>
            <div className="text-sm text-gray-400">Orders: 0</div>
          </div>
        </aside>
      </main>
    </SellerLayout>
  );
}
