
/**
 * @fileOverview PesaPal V3 API Integration Utility
 */

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
        const response = await fetch(`${PESAPAL_URL}/api/Auth/RequestToken`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                consumer_key: consumerKey,
                consumer_secret: consumerSecret,
            }),
        });

        const data = await response.json();
        
        if (!response.ok || !data.token) {
            throw new Error(`PesaPal Auth Failed: ${data.message || response.statusText}`);
        }

        return data.token;
    } catch (err: any) {
        throw new Error(`PesaPal Network Error (Auth): ${err.message}`);
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
        const response = await fetch(`${PESAPAL_URL}/api/Services/RegisterIPN`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                url: ipnUrl,
                ipn_notification_type: 'GET',
            }),
        });

        const data = await response.json();
        if (!response.ok || !data.ipn_id) {
            throw new Error(`IPN Registration Failed: ${data.message || response.statusText}`);
        }

        return data.ipn_id;
    } catch (err: any) {
        throw new Error(`PesaPal Network Error (IPN): ${err.message}`);
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
        const response = await fetch(`${PESAPAL_URL}/api/Transactions/SubmitOrderRequest`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        
        if (!response.ok || data.status !== '200') {
            throw new Error(`PesaPal Order Error: ${data.message || response.statusText}`);
        }

        return {
            redirectUrl: data.redirect_url,
            orderTrackingId: data.order_tracking_id
        };
    } catch (err: any) {
        throw new Error(`PesaPal Network Error (Order): ${err.message}`);
    }
}
