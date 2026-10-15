
'use server';

import { db } from '@/firebase/server';
import type { Complaint } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

interface ComplaintPayload {
    complainantId: string;
    /** Omit when there is no specific target — stored as 'unknown' (an empty id
     *  would break admin cells that `doc()` with it as a document id). */
    targetId?: string;
    /** `order` and `system` are stored as-is / mapped below — see the write. */
    targetType: 'user' | 'product' | 'order' | 'system';
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
            targetId: payload.targetId || 'unknown',
            // 'system' is how the report form tags a platform bug; the
            // moderation console groups those under 'other'.
            targetType: payload.targetType === 'system' ? 'other' : payload.targetType,
            reason: payload.reason,
            description: payload.description,
            orderId: payload.orderId || '',
            // attachments: payload.uploadedFileUrls || [], // Assuming 'attachments' field exists in Complaint type
            status: 'open',
            createdAt: FieldValue.serverTimestamp(),
        };

        await complaintRef.set(newComplaint);

        return { success: true };

    } catch (error: any) {
        console.error("Error creating complaint:", error);
        return { success: false, error: 'Failed to create complaint. Check server logs.' };
    }
}
