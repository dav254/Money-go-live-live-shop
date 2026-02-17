'use server';

/**
 * @fileOverview Server Actions for sending emails.
 * Note: You will need to add an API Key for a service like Resend, SendGrid, or Postmark.
 */

interface SendEmailPayload {
    to: string;
    subject: string;
    body: string;
}

export async function sendMarketingEmail(payload: SendEmailPayload): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`[Email Service] Attempting to send email to ${payload.to}`);
        console.log(`Subject: ${payload.subject}`);
        
        // --- REAL IMPLEMENTATION TEMPLATE (e.g., using Resend) ---
        /*
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'Go Earn <hello@goearn.co.ke>',
                to: [payload.to],
                subject: payload.subject,
                html: payload.body,
            }),
        });
        
        if (!res.ok) throw new Error('Failed to send via provider API');
        */

        // For MVP, we log the success since real sending requires an external API key.
        return { success: true };

    } catch (error: any) {
        console.error("Email sending failed:", error);
        return { success: false, error: 'Internal mail server error.' };
    }
}
