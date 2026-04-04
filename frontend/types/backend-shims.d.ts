declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
  }
}

declare module 'bullmq' {
  export class Queue<T = any, R = any, N extends string = string> {
    constructor(name: string, opts?: any);
    add(name: N, data: T, opts?: any): Promise<any>;
  }
  export class Worker<T = any, R = any, N extends string = string> {
    constructor(name: string, processor: (job: any) => Promise<R>, opts?: any);
    on(event: string, handler: (...args: any[]) => void): any;
  }
}

declare module 'express' {
  export interface Request {
    [key: string]: any;
  }
  export interface Response {
    status(code: number): Response;
    json(body: any): Response;
    send(body?: any): Response;
  }
  export type NextFunction = (err?: any) => void;
  export function Router(): any;
}

