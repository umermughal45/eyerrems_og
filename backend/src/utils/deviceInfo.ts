import { Request } from 'express';

export interface DeviceInfo {
  userAgent: string;
  ip: string;
  deviceId: string;
  platform?: string;
  browser?: string;
}

export const extractDeviceInfo = (req: Request): DeviceInfo => {
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Generate a device ID based on user agent and IP (in production, use a more robust method)
  const deviceId = Buffer.from(`${userAgent}-${ip}`).toString('base64').substring(0, 32);

  // Simple browser/platform detection
  let platform = 'unknown';
  let browser = 'unknown';

  if (userAgent.includes('Windows')) platform = 'Windows';
  else if (userAgent.includes('Mac')) platform = 'Mac';
  else if (userAgent.includes('Linux')) platform = 'Linux';
  else if (userAgent.includes('Android')) platform = 'Android';
  else if (userAgent.includes('iOS')) platform = 'iOS';

  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  return {
    userAgent,
    ip,
    deviceId,
    platform,
    browser,
  };
};

