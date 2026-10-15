import { NextResponse } from 'next/server';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// For Next.js app-router server route: disable default body parsing (if required by your Next config)
export const config = {
  api: {
    bodyParser: false,
  },
};

const DEFAULT_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

function parseForm(req: any, uploadDir: string) {
  return new Promise<{ fields: any; files: any }>((resolve, reject) => {
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 200 * 1024 * 1024, // 200MB
      allowEmptyFiles: false,
    });

    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export async function POST(request: Request) {
  try {
    const uploadDir = process.env.MEDIA_UPLOAD_DIR || DEFAULT_UPLOAD_DIR;
    await fs.promises.mkdir(uploadDir, { recursive: true });

    // formidable expects a Node IncomingMessage; Next.js Request sometimes works when passed directly.
    const { fields, files } = await parseForm(request as any, uploadDir);

    // The client sends file under field name "file"
    const fileField = files.file || files.files || Object.values(files)[0];
    if (!fileField) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // formidable returns a File object or an array if multiple files; normalize to single file
    const file = Array.isArray(fileField) ? fileField[0] : fileField;
    const savedPath = file.filepath || file.path;
    const filename = path.basename(savedPath);

    // Build public URL for the saved file. Configure MEDIA_BASE_URL for production (https://uploads.example.com)
    const base = process.env.MEDIA_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || '';
    const publicUrl = base ? `${base.replace(/\/$/, '')}/uploads/${filename}` : `/uploads/${filename}`;

    // Return url & thumbnailUrl (backend can add thumbnail creation later)
    return NextResponse.json({ url: publicUrl, thumbnailUrl: publicUrl });
  } catch (err: any) {
    console.error('media/upload error', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
