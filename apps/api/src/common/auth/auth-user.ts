import type { Permission, Role } from '@meca/shared';

/** Usuario autenticado adjunto al request por el guard JWT. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  permissions: readonly Permission[];
}
