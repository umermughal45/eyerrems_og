declare module 'cors' {
  import { Request, Response, NextFunction } from 'express';
  
  export type CorsOptions = {
    origin?: string | string[] | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) | boolean;
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
  };
  
  function cors(options?: CorsOptions): (req: Request, res: Response, next: NextFunction) => void;
  export default cors;
}

