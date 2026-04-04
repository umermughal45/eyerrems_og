import { Request } from 'express';
export interface DeviceInfo {
    userAgent: string;
    ip: string;
    deviceId: string;
    platform?: string;
    browser?: string;
}
export declare const extractDeviceInfo: (req: Request) => DeviceInfo;
//# sourceMappingURL=deviceInfo.d.ts.map