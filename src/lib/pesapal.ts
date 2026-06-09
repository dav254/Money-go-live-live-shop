
/**
 * @fileOverview PesaPal V3 API Integration Utility
 */

import axios from 'axios';

const PESAPAL_URL = process.env.PESAPAL_ENVIRONMENT === 'live' 
    ? 'https://pay.pesapal.com/v3' 
    : 'https://cybil.pesapal.com/v3';

/**
 * Authenticates with PesaPal to retrieve an access token.
 */
export async function getPesapalAuthToken(): Promise<string> {
    const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
        throw new Error('PesaPal credentials (KEY/SECRET) are missing in server environment.');
    }

    try {
        const response = await axios.post(`${PESAPAL_URL}/api/Auth/RequestToken`, {
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        if (response.status !== 200 || !response.data.token) {
            throw new Error(`PesaPal Auth Failed: ${response.data.message || response.statusText}`);
        }

        return response.data.token;
    } catch (err: any) {
        const message = err.response?.data?.message || err.message;
        throw new Error(`PesaPal Network Error (Auth): ${message}`);
    }
}

/**
 * Registers an IPN (Instant Payment Notification) URL with PesaPal.
 */
export async function registerPesapalIPN(token: string): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) throw new Error('NEXT_PUBLIC_BASE_URL is missing.');

    const ipnUrl = `${baseUrl}/api/webhooks/pesapal`;

    try {
        const response = await axios.post(`${PESAPAL_URL}/api/Services/RegisterIPN`, {
            url: ipnUrl,
            ipn_notification_type: 'GET',
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        if (response.status !== 200 || !response.data.ipn_id) {
            throw new Error(`IPN Registration Failed: ${response.data.message || response.statusText}`);
        }

        return response.data.ipn_id;
    } catch (err: any) {
        const message = err.response?.data?.message || err.message;
        throw new Error(`PesaPal Network Error (IPN): ${message}`);
    }
}

/**
 * Submits a transaction request to PesaPal and returns the redirect URL.
 */
export async function submitPesapalOrder(payload: {
    orderId: string;
    amount: number;
    email: string;
    firstName: string;
    lastName: string;
    description: string;
}) {
    const token = await getPesapalAuthToken();
    const ipnId = await registerPesapalIPN(token);

    const requestBody = {
        id: payload.orderId,
        currency: 'USD',
        amount: payload.amount,
        description: payload.description,
        callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${payload.orderId}?gateway=pesapal`,
        notification_id: ipnId,
        billing_address: {
            email_address: payload.email,
            first_name: payload.firstName,
            last_name: payload.lastName,
        },
    };

    try {
        const response = await axios.post(`${PESAPAL_URL}/api/Transactions/SubmitOrderRequest`, requestBody, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        if (response.status !== 200) {
            throw new Error(`PesaPal Order Error: ${response.data.message || response.statusText}`);
        }

        return {
            redirectUrl: response.data.redirect_url,
            orderTrackingId: response.data.order_tracking_id
        };
    } catch (err: any) {
        const message = err.response?.data?.message || err.message;
        throw new Error(`PesaPal Network Error (Order): ${message}`);
    }
}
