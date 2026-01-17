
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, onSnapshot, collection, addDoc, setDoc, deleteDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import type { LiveSession, Product, Seller, SellerShop, UserProfile, VideoFeedItem, Comment } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { VideoInfo } from '@/components/feed/video-info';
import { VideoActions } from '@/components/feed/video-actions';
import { ProductDrawer } from '@/components/feed/product-drawer';
import { CommentDrawer } from '@/components/feed/comment-drawer';
import { ProductInfo } from '@/components/live/product-info';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface BuyerVideoCardProps {
    liveSession: LiveSession;
    onScroll: (direction: 'up' | 'down') => void;
    isIntersecting: boolean;
}

export function BuyerVideoCard({ liveSession, onScroll, isIntersecting }: BuyerVideoCardProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    // Fetch Seller and Product data
    const sellerShopRef = useMemoFirebase(() => doc(firestore, 'sellerShops', liveSession.sellerId), [firestore, liveSession.sellerId]);
    const sellerProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', liveSession.sellerId), [firestore, liveSession.sellerId]);
    
    // For now, let's assume the first product is the one being shown.
    const productRef = useMemoFirebase(() => liveSession.productIds?.[0] ? doc(firestore, 'products', liveSession.productIds[0]) : null, [firestore, liveSession.productIds]);
    
    const { data: sellerShop } = useDoc<SellerShop>(sellerShopRef);
    const { data: sellerProfile } = useDoc<UserProfile>(sellerProfileRef);
    const { data: product } = useDoc<Product>(productRef);

    const commentsQuery = useMemoFirebase(() => {
        if (!liveSession.id) return null;
        return query(collection(firestore, 'liveSessions', liveSession.id, 'chat'), orderBy('timestamp', 'asc'));
    }, [firestore, liveSession.id]);

    const { data: comments, isLoading: areCommentsLoading } = useCollection<Comment>(commentsQuery);

    const handleAddComment = async (text: string) => {
        if (!user || !liveSession.id) return;
        const commentsRef = collection(firestore, 'liveSessions', liveSession.id, 'chat');
        await addDoc(commentsRef, { text, senderId: user.uid, senderName: user.displayName || 'Viewer', timestamp: serverTimestamp() });
    };

    const toggleMute = () => {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        if (remoteVideoRef.current) remoteVideoRef.current.muted = newMutedState;
    };


    const setupPeerConnection = useCallback(async () => {
        if (!firestore || !user || !liveSession.id || peerConnectionRef.current) return;
        setIsConnecting(true);

        const pc = new RTCPeerConnection(servers);
        peerConnectionRef.current = pc;
        
        pc.ontrack = event => {
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setIsConnecting(false);
            }
        };

        const sessionRef = doc(firestore, 'liveSessions', liveSession.id);
        const offerCandidates = collection(sessionRef, 'offerCandidates');
        const answerCandidates = collection(sessionRef, 'answerCandidates');
        
        pc.onicecandidate = async event => {
            if (event.candidate) {
                await addDoc(answerCandidates, { ...event.candidate.toJSON(), viewerId: user.uid });
            }
        };
        
        await setDoc(doc(sessionRef, 'viewers', user.uid), { joinedAt: serverTimestamp() });

        const unsubOffer = onSnapshot(doc(sessionRef, 'offers', user.uid), async (offerDoc) => {
            if (offerDoc.exists()) {
                try {
                    const offerDescription = new RTCSessionDescription(offerDoc.data().offer);
                    if (pc.signalingState !== 'stable') {
                        await pc.setRemoteDescription(offerDescription);
                    }
                    const answerDescription = await pc.createAnswer();
                    await pc.setLocalDescription(answerDescription);
                    const answer = { answer: { type: answerDescription.type, sdp: answerDescription.sdp }, viewerId: user.uid };
                    await setDoc(doc(sessionRef, 'answers', user.uid), answer);
                } catch (e) {
                    console.error("Error handling offer:", e);
                }
            }
        });

        const unsubIce = onSnapshot(query(offerCandidates, where('viewerId', '==', user.uid)), (iceSnapshot) => {
            iceSnapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    try {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        if (pc.remoteDescription) {
                            await pc.addIceCandidate(candidate);
                        }
                    } catch (e) {
                        console.error("Error adding ICE candidate:", e);
                    }
                }
            });
        });
        
        return () => { unsubOffer(); unsubIce(); };
    }, [firestore, user, liveSession.id]);

    useEffect(() => {
        let cleanup: (() => void) | undefined;
        if (isIntersecting && user) {
            setupPeerConnection().then(c => { cleanup = c; });
        } else {
             if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
        }

        return () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            if (firestore && user && liveSession.id) {
                deleteDoc(doc(firestore, 'liveSessions', liveSession.id, 'viewers', user.uid));
            }
            if (cleanup) cleanup();
        };
    }, [isIntersecting, setupPeerConnection, firestore, user, liveSession.id]);
    
    const seller = useMemo(() => {
        if (!sellerProfile) return null;
        return {
            id: sellerProfile.id,
            sellerId: sellerProfile.id,
            name: sellerShop?.shopName || sellerProfile.fullName,
            avatar: { imageUrl: sellerShop?.logoUrl || sellerProfile.profilePictureUrl || getPlaceholderImage() },
        } as Seller;
    }, [sellerShop, sellerProfile]);

    if (!seller || !product) {
        return <div className="h-full w-full snap-start flex-shrink-0 bg-black flex items-center justify-center"><Skeleton className="h-full w-full" /></div>
    }

    return (
        <div className="relative h-full w-full bg-black">
            <video ref={remoteVideoRef} className="w-full h-full object-contain" autoPlay playsInline muted={isMuted} />
            {isConnecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
            
            <VideoInfo seller={seller} />
            <VideoActions product={product} onProductClick={() => setIsDrawerOpen(true)} onCommentClick={() => setIsCommentDrawerOpen(true)} onScroll={onScroll} isMuted={isMuted} onMuteToggle={toggleMute} />
            {product && <ProductInfo product={product} />}
            <ProductDrawer product={product} isOpen={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
            <CommentDrawer comments={comments || []} isLoading={areCommentsLoading} isOpen={isCommentDrawerOpen} onOpenChange={setIsCommentDrawerOpen} onAddComment={handleAddComment} />
        </div>
    );
}

