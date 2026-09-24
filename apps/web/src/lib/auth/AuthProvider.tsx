import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { type Permission, Role, type AuthUser } from '@meca/shared';
import { api } from '../api/client';
import { authApi } from '../api/endpoints';
import { NetworkError } from '../api/errors';
import { cachedUser, clearLocalData, db, rememberUser } from '../offline/db';
import { syncEngine } from '../offline/sync-engine';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** true cuando la app se abrió sin conexión con el perfil guardado (sin token vigente). */
  offlineSession: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  can: (p: Permission) => boolean;
  isTechnician: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [offlineSession, setOfflineSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = api.onSessionChange((session) => {
      if (session) {
        setUser(session.user);
        setOfflineSession(false);
        void rememberUser(session.user);
      }
    });
    (async () => {
      try {
        const session = await api.refresh();
        if (cancelled) return;
        if (session) {
          setUser(session.user);
          setStatus('authenticated');
        } else {
          setStatus('anonymous');
        }
      } catch (error) {
        // Sin conexión: el técnico puede seguir trabajando con los datos del dispositivo.
        const cached = error instanceof NetworkError ? await cachedUser() : null;
        if (cancelled) return;
        if (cached) {
          setUser(cached);
          setOfflineSession(true);
          setStatus('authenticated');
        } else {
          setStatus('anonymous');
        }
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && user?.role === Role.TECHNICIAN) syncEngine.start({ pull: true });
  }, [status, user]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login(email, password);
    const previous = await cachedUser();
    if (previous && previous.id !== session.user.id) {
      // Otro usuario en el mismo dispositivo: no se mezclan datos locales.
      const pending = await db.outbox.count();
      if (pending === 0) await clearLocalData();
    }
    api.setSession(session);
    await rememberUser(session.user);
    setUser(session.user);
    setOfflineSession(false);
    setStatus('authenticated');
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* sin conexión: la cookie expira sola; se limpia el estado local igualmente */
    }
    syncEngine.stop();
    api.setSession(null);
    await clearLocalData();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      offlineSession,
      login,
      logout,
      can: (p) => Boolean(user?.permissions.includes(p)),
      isTechnician: user?.role === Role.TECHNICIAN,
    }),
    [status, user, offlineSession, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
