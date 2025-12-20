
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DatabaseZap, Download, Upload, AlertTriangle, List, Clock } from 'lucide-react';
import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AdminBackupPage() {
  const { toast } = useToast();
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleBackup = () => {
    setIsBackingUp(true);
    toast({ title: "Backup Initiated", description: "This is a placeholder. A real implementation would trigger a Cloud Function." });
    setTimeout(() => setIsBackingUp(false), 3000);
  };

  const handleRestore = () => {
    toast({ title: "Restore Functionality", description: "This is a placeholder. Restoring requires uploading a backup file." });
  };

  return (
    <AdminLayout>
      <div className="flex-1 space-y-6 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          System & Settings: Backup & Restore
        </h1>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Action Warning</AlertTitle>
          <AlertDescription>
            These actions directly affect your live database. Restoring from a backup will overwrite current data. Proceed with extreme caution.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DatabaseZap /> On-Demand Backup</CardTitle>
              <CardDescription>Create a complete snapshot of your Firestore database. Backups are stored securely in a private Cloud Storage bucket.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleBackup} disabled={isBackingUp} className="w-full">
                {isBackingUp ? "Backing up..." : "Create Full Backup Now"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload /> Restore from Backup</CardTitle>
              <CardDescription>Restore the database to a previous state from a backup file. This will overwrite ALL existing data.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleRestore} variant="outline" className="w-full">
                Select Backup File to Restore
              </Button>
            </CardContent>
          </Card>
        </div>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><List /> Backup History</CardTitle>
                <CardDescription>List of recent database backups.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-center text-center text-muted-foreground p-12 border rounded-lg border-dashed">
                    <p>No recent backups found. Click "Create Full Backup Now" to get started.</p>
                </div>
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
