
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const response = await fetch(`https://ipapi.co/${ip}/json/`);
  const data = await response.json();

  res.status(200).json({ country: data.country_name });
}
