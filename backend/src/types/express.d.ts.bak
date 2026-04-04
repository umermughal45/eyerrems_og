declare module 'express' {
  import * as http from 'http';
  
  export interface Request extends http.IncomingMessage {
    body?: any;
    params?: any;
    query?: any;
    headers: http.IncomingHttpHeaders & {
      [key: string]: string | string[] | undefined;
    };
    cookies?: any;
    method?: string;
    path?: string;
    ip?: string;
    socket?: any;
  }
  
  export interface Response extends http.ServerResponse {
    status(code: number): Response;
    json(body: any): Response;
    send(body?: any): Response;
    setHeader(name: string, value: string | number | string[]): Response;
    req?: Request;
  }
  
  export interface NextFunction {
    (err?: any): void;
  }
  
  export interface Router {
    get(path: string, ...handlers: Array<(req: Request, res: Response, next?: NextFunction) => void>): void;
    post(path: string, ...handlers: Array<(req: Request, res: Response, next?: NextFunction) => void>): void;
    put(path: string, ...handlers: Array<(req: Request, res: Response, next?: NextFunction) => void>): void;
    delete(path: string, ...handlers: Array<(req: Request, res: Response, next?: NextFunction) => void>): void;
    patch(path: string, ...handlers: Array<(req: Request, res: Response, next?: NextFunction) => void>): void;
  }
  
  function express(): {
    use(...handlers: any[]): void;
    listen(port: number, callback?: () => void): void;
    Router(): Router;
  };
  
  export default express;
  export { Request, Response, NextFunction, Router };
}

