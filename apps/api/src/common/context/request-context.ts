import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextData {
  requestId?: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContextData>();

/** Contexto por request (correlation id, IP, user agent) accesible desde servicios. */
export const RequestContext = {
  run<T>(data: RequestContextData, fn: () => T): T {
    return storage.run(data, fn);
  },
  get(): RequestContextData {
    return storage.getStore() ?? {};
  },
  setUser(userId: string) {
    const store = storage.getStore();
    if (store) store.userId = userId;
  },
};
