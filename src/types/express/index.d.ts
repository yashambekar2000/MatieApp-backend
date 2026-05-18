import { User } from './auth';
import { Session } from './auth';
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
      token?: string;
      requestId?: string;
    }
  }
}

export {};
