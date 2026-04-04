declare module 'multer' {
  import { Request } from 'express';
  
  export interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }
  
  export interface StorageEngine {
    _handleFile(req: Request, file: File, callback: (error?: any, info?: Partial<File>) => void): void;
    _removeFile(req: Request, file: File, callback: (error: Error) => void): void;
  }
  
  export interface MulterOptions {
    storage?: StorageEngine;
    limits?: {
      fileSize?: number;
      files?: number;
      fields?: number;
      fieldNameSize?: number;
      fieldSize?: number;
      headerPairs?: number;
    };
    fileFilter?: (req: Request, file: File, callback: (error: Error | null, acceptFile: boolean) => void) => void;
  }
  
  interface MulterFunction {
    (options?: MulterOptions): {
      single(fieldname: string): (req: Request, res: any, next: any) => void;
      array(fieldname: string, maxCount?: number): (req: Request, res: any, next: any) => void;
      fields(fields: Array<{ name: string; maxCount?: number }>): (req: Request, res: any, next: any) => void;
      none(): (req: Request, res: any, next: any) => void;
      any(): (req: Request, res: any, next: any) => void;
    };
    memoryStorage(): StorageEngine;
  }
  
  export function memoryStorage(): StorageEngine;
  
  const multer: MulterFunction;
  export default multer;
}

