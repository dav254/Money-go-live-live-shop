'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { ErrorLog } from '@/lib/types';


export default function ErrorLogsPage() {
  const firestore = useFirestore();
  const errorLogsQuery = query(collection(firestore, 'errorLogs'), orderBy('timestamp', 'desc'));
  const { data: errorLogs, isLoading } = useCollection<ErrorLog>(errorLogsQuery);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Frontend Error Logs</CardTitle>
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
                    </tr>
                  </thead>
                  <tbody className="bg-gray-900 divide-y divide-gray-700">
                    {errorLogs?.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{new Date(log.timestamp?.toDate()).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400">{log.errorMessage}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{log.userId || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{log.status}</td>
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
