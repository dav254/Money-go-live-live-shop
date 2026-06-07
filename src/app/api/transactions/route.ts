import { NextResponse } from 'next/server';
<<<<<<< HEAD
=======
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Mock data for demonstration
const mockTransactions = [
  {
    id: '1',
    date: new Date('2023-10-26T10:00:00Z'),
    type: 'purchase',
    description: 'Vintage Leather Jacket',
    status: 'Completed',
    amount: -120.00,
  },
  {
    id: '2',
    date: new Date('2023-10-24T15:30:00Z'),
    type: 'withdrawal',
    description: 'Withdrawal to Bank Account',
    status: 'Completed',
    amount: -500.00,
  },
    {
    id: '3',
    date: new Date('2023-10-22T12:10:00Z'),
    type: 'purchase',
    description: 'Handmade Ceramic Mug',
    status: 'Completed',
    amount: -25.50,
  },
  {
    id: '4',
    date: new Date('2023-10-20T09:05:00Z'),
    type: 'refund',
    description: 'Refund for Damaged Item',
    status: 'Completed',
    amount: 45.00,
  },
  {
    id: '5',
    date: new Date('2023-10-18T18:45:00Z'),
    type: 'purchase',
    description: 'Graphic T-Shirt',
    status: 'Pending',
    amount: -30.00,
  },
];
>>>>>>> 0c57e3d3b3098531b5f6d63d587f0358bde11c65

/**
 * DEPRECATED: This route was using an incompatible auth provider (NextAuth).
 * All authentication is handled by Firebase.
 */
export async function GET() {
<<<<<<< HEAD
    return NextResponse.json({ message: 'Route Deprecated.' }, { status: 410 });
=======
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    return NextResponse.json(mockTransactions);
  } catch (error) {
    console.error('[TRANSACTIONS_GET]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
>>>>>>> 0c57e3d3b3098531b5f6d63d587f0358bde11c65
}
