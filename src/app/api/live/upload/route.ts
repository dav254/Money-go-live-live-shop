
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';

// Function to ensure directory exists
async function ensureDir(dirPath: string) {
    try {
        await fs.access(dirPath);
    } catch (e) {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const videoFile = formData.get('video') as File | null;

        if (!videoFile) {
            return NextResponse.json({ success: false, error: 'No video file uploaded.' }, { status: 400 });
        }

        const publicDir = path.join(process.cwd(), 'public');
        const liveDir = path.join(publicDir, 'live');
        const filePath = path.join(liveDir, 'live.webm');

        // Ensure the /public/live directory exists
        await ensureDir(liveDir);

        // Convert the blob to a buffer
        const buffer = Buffer.from(await videoFile.arrayBuffer());

        // Write the buffer to the file, overwriting it
        await fs.writeFile(filePath, buffer);
        
        return NextResponse.json({ success: true, message: 'Live chunk updated.' });
    } catch (error) {
        console.error('Error handling video upload:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
