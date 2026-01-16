
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const form = formidable({});
    const [fields, files] = await form.parse(req);

    const imageFile = Array.isArray(files.frame) ? files.frame[0] : undefined;

    if (!imageFile) {
      return res.status(400).json({ success: false, error: 'No image frame uploaded.' });
    }

    const publicDir = path.join(process.cwd(), 'public');
    const liveDir = path.join(publicDir, 'live');
    const filePath = path.join(liveDir, 'live.jpg');

    // Ensure the /public/live directory exists
    try {
      await fs.access(liveDir);
    } catch (e) {
      await fs.mkdir(liveDir, { recursive: true });
    }

    // Read the file from the temporary path and write it
    const fileData = await fs.readFile(imageFile.filepath);
    await fs.writeFile(filePath, fileData);

    return res.status(200).json({ success: true, message: 'Live frame updated.' });
  } catch (error) {
    console.error('Error handling image upload:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
