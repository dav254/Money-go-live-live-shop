
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // In a real application, you would fetch this data from your database
    // For now, we're returning mock data.
    // const transactions = await db.transaction.findMany({
    //   where: {
    //     userId: session.user.id,
    //   },
    //   orderBy: {
    //     date: 'desc',
    //   },
    // });

    return NextResponse.json(mockTransactions);
  } catch (error) {
    console.error('[TRANSACTIONS_GET]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
