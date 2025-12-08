'use client';
import Recorder from "@/components/studio/Recorder";
import { SellerLayout } from "@/components/layout/seller-layout";

export default function Record() {
  return (
    <SellerLayout>
        <div className="h-[calc(100vh-4rem)] bg-black text-white flex flex-col">
            <h1 className="text-xl font-bold p-4">Record Your Product Video</h1>
            <Recorder />
        </div>
    </SellerLayout>
  );
}
