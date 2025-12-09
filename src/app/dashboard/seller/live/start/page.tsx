
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { FlipHorizontal, Users, Heart, Camera } from 'lucide-react';
import { LiveActivityFeed } from '@/components/studio/LiveActivityFeed';

const MOCK_PRODUCTS = [
  { id: "p1", name: "Summer Vibes T-Shirt", priceUSD: 15.0, img: "https://picsum.photos/seed/p1/320/240", stock: 12 },
  { id: "p2", name: "Handmade Woven Bag", priceUSD: 24.5, img: "https://picsum.photos/seed/p2/320/240", stock: 5 },
  { id: "p3", name: "Classic Leather Watch", priceUSD: 75.0, img: "https://picsum.photos/seed/p3/320/240", stock: 8 },
];

export default function SellerLiveStudioPage() {
  // camera & recording
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedURL, setRecordedURL] = useState<string | null>(null);

  // products / pin
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [pinnedProduct, setPinnedProduct] = useState<(typeof MOCK_PRODUCTS[0]) | null>(null);

  // chat (local mock)
  const [messages, setMessages] = useState([
    { id: 1, user: "Alice", text: "Is it available in M?" },
    { id: 2, user: "Bob", text: "Price?" },
  ]);
  const [chatInput, setChatInput] = useState("");

  // business features
  const [resellerMode, setResellerMode] = useState(false);
  const [shippingCost, setShippingCost] = useState(3.5);

  // --- BUSINESS LOGIC & MOCKS ---

  // Profit Preview Calculator
  function calcProfit(priceUSD: number) {
    const platformFeePct = 0.05; // example 5%
    const payoutFee = priceUSD * platformFeePct;
    const shipping = Number(shippingCost || 0);
    const costOfGoods = priceUSD * 0.35; // assumed COGS
    const profit = priceUSD - payoutFee - shipping - costOfGoods;
    return { profit: Math.max(0, +profit.toFixed(2)), fee: +payoutFee.toFixed(2) };
  }

  // --- MEDIA & RECORDING LOGIC ---

  async function startCamera(facingMode: 'user' | 'environment' = 'user') {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("Camera error", err);
      alert("Cannot access camera. Please allow camera/microphone permissions in your browser settings.");
    }
  }

  async function switchCamera() {
    if (!stream) {
      startCamera();
      return;
    }
    const currentTrack = stream.getVideoTracks()[0];
    if (!currentTrack) return;

    const currentFacingMode = currentTrack.getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    
    startCamera(newFacingMode);
  }

  function startRecording() {
    if (!stream) {
      alert("Start the camera first.");
      return;
    }
    recordedChunksRef.current = [];
    const options = { mimeType: "video/webm;codecs=vp9,opus" };
    try {
      const mr = new MediaRecorder(stream, options);
      recorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data && e.data.size) recordedChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedURL(url);
        // TODO: In a real app, upload blob to backend using a presigned URL
      };
      mr.start(250);
      setIsRecording(true);
    } catch (err) {
      console.error("MediaRecorder error", err);
      alert("Recording is not supported on this browser.");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }

  useEffect(() => {
    startCamera(); // Automatically start camera on component mount
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  function sendChat() {
    if (!chatInput.trim()) return;
    setMessages(m => [...m, { id: Date.now(), user: "You (Seller)", text: chatInput }]);
    setChatInput("");
    // TODO: In a real app, emit this message via a WebSocket
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <div className="p-4 max-w-full mx-auto grid grid-cols-12 gap-4">
        {/* Left Column: Preview & Controls */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="relative bg-black rounded-lg border border-border overflow-hidden aspect-video">
            <video
              id="studio-preview"
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {pinnedProduct && (
              <div className="absolute left-4 bottom-4 bg-black/70 border border-primary p-3 rounded-xl max-w-xs animate-in fade-in zoom-in-95">
                <div className="flex gap-3">
                  <Image src={pinnedProduct.img} alt={pinnedProduct.name} width={64} height={64} className="w-16 h-16 object-cover rounded" />
                  <div>
                    <p className="font-semibold text-sm">{pinnedProduct.name}</p>
                    <p className="text-primary font-bold">${pinnedProduct.priceUSD}</p>
                    <Button size="sm" className="mt-1 h-7" onClick={() => setPinnedProduct(null)}>Unpin</Button>
                  </div>
                </div>
              </div>
            )}
            <div className="absolute top-3 left-3 flex gap-2">
              <div className="px-2 py-1 rounded text-xs font-semibold bg-muted">PREVIEW</div>
            </div>
            <div className="absolute top-3 right-3">
                <Button variant="ghost" size="icon" className="bg-black/50" onClick={switchCamera}><FlipHorizontal size={18}/></Button>
            </div>
          </div>

          <Card className="bg-card/50">
            <CardContent className="p-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button onClick={startCamera} variant="secondary"><Camera className="mr-2 h-4 w-4" /> Start Camera</Button>
                {!isRecording ? (
                  <Button onClick={startRecording} className="bg-red-600 hover:bg-red-700 font-bold">Start Recording</Button>
                ) : (
                  <Button onClick={stopRecording} variant="destructive">Stop Recording</Button>
                )}
                 <Button onClick={() => recordedURL && window.open(recordedURL)} variant="outline" disabled={!recordedURL}>Preview Last Recording</Button>
              </div>
              <Button disabled>Schedule Premiere...</Button>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card className="bg-card/50">
              <CardHeader><CardTitle className="text-base">Profit Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                    <Label>Shipping (USD)</Label>
                    <Input type="number" value={shippingCost} onChange={(e) => setShippingCost(Number(e.target.value))} className="h-8"/>
                </div>
                <div className="mt-3 space-y-1">
                    {products.slice(0, 2).map(p => {
                        const { profit, fee } = calcProfit(p.priceUSD);
                        return <div key={p.id} className="flex justify-between text-xs py-1 border-b border-border">
                            <span className="truncate pr-2">{p.name}</span>
                            <span>${profit} <span className="text-muted-foreground">(${fee} fee)</span></span>
                        </div>;
                    })}
                </div>
              </CardContent>
            </Card>
            <div className="bg-card/50 p-4 rounded-lg flex-1 flex flex-col">
                <LiveActivityFeed />
            </div>
          </div>
        </div>

        {/* Right Column: Shelf & Chat */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Card className="bg-card/50">
            <CardHeader><CardTitle className="text-base">Product Shelf</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-3">
                <div className="space-y-2">
                  {products.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-background/50 p-2 rounded">
                      <Image src={p.img} alt={p.name} width={56} height={56} className="w-14 h-14 object-cover rounded" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-primary font-bold text-sm">${p.priceUSD}</p>
                      </div>
                      <Button size="sm" onClick={() => setPinnedProduct(p)} variant="secondary">Pin</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Button variant="outline" className="w-full mt-3">Add New Product</Button>
            </CardContent>
          </Card>

          <Card className="bg-card/50 flex flex-col h-[calc(100vh-28rem)] max-h-[500px]">
            <CardHeader><CardTitle className="text-base">Live Chat (Simulation)</CardTitle></CardHeader>
            <CardContent className="flex-1 flex flex-col gap-2">
                <ScrollArea className="flex-1 bg-background/50 p-2 rounded">
                    <div className="space-y-3">
                    {messages.map(m => (
                        <div key={m.id} className={`p-2 rounded-lg text-sm max-w-[85%] ${m.user === "You (Seller)" ? "bg-primary text-primary-foreground self-end rounded-br-none" : "bg-muted self-start rounded-bl-none"}`}>
                            <div className="text-xs font-bold opacity-80">{m.user}</div>
                            <p>{m.text}</p>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
                <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2">
                    <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Simulate a chat message..." />
                    <Button type="submit">Send</Button>
                </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
