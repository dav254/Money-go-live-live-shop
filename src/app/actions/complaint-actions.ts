
'use server';

import { db } from '@/firebase/server';
import type { Complaint } from '@/lib/types';
import { serverTimestamp } from 'firebase-admin/firestore';

interface ComplaintPayload {
    complainantId: string;
    targetId: string;
    targetType: 'user' | 'product' | 'system';
    reason: string;
    description: string;
    orderId?: string;
    uploadedFileUrls?: string[];
}

export async function createComplaint(payload: ComplaintPayload): Promise<{ success: boolean; error?: string }> {
    try {
        const complaintRef = db.collection('complaints').doc();
        
        const newComplaint: Partial<Complaint> = {
            id: complaintRef.id,
            complainantId: payload.complainantId,
            targetId: payload.targetId,
            targetType: payload.targetType,
            reason: payload.reason,
            description: payload.description,
            orderId: payload.orderId || '',
            // attachments: payload.uploadedFileUrls || [], // Assuming 'attachments' field exists in Complaint type
            status: 'open',
            createdAt: serverTimestamp(),
        };

        await complaintRef.set(newComplaint);

        return { success: true };

    } catch (error: any) {
        console.error("Error creating complaint:", error);
        return { success: false, error: 'Failed to create complaint. Check server logs.' };
    }
}
