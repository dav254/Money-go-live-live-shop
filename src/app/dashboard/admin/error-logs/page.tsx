'use client';

import React, { useMemo } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';

// Define the type for an error log
interface ErrorLog {
  id: string;
  timestamp: any;
  errorMessage: string;
  errorStack?: string;
  userId?: string;
  context?: any;
  status: 'new' | 'analyzed' | 'fixed';
  aiAnalysis?: string;
  aiSuggestedFix?: string;
}

export default function ErrorLogsPage() {
  const firestore = useFirestore();
  const errorLogsQuery = useMemo(() => query(collection(firestore, 'errorLogs'), orderBy('timestamp', 'desc')), [firestore]);
  const { data: errorLogs, isLoading } = useCollection<ErrorLog>(errorLogsQuery);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Application Error Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading error logs...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-800">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Timestamp</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Error</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User ID</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-900 divide-y divide-gray-700">
                    {errorLogs?.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{new Date(log.timestamp?.toDate()).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400">{log.errorMessage}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{log.userId || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{log.status}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <a href="#" className="text-indigo-400 hover:text-indigo-600">View Details</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
