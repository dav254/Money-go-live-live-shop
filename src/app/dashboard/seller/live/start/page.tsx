'use client';

import React from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import Recorder from "@/components/studio/Recorder";

export default function LiveStudioStartPage() {

  return (
    <SellerLayout>
        <div className="h-[calc(100vh-4rem)] bg-black text-white flex flex-col">
            <h1 className="text-xl font-bold p-4">Record Your Product Video</h1>
            <Recorder />
        </div>
    </SellerLayout>
  );
}
