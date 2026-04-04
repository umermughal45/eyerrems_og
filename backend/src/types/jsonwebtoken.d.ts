declare module 'jsonwebtoken' {
  export interface SignOptions {
    expiresIn?: string | number;
    algorithm?: string;
    issuer?: string;
    subject?: string;
    audience?: string;
    [key: string]: any;
  }
  
  export function sign(payload: any, secretOrPrivateKey: string, options?: SignOptions): string;
  export function verify(token: string, secretOrPublicKey: string): any;
  export function decode(token: string): any;
}

