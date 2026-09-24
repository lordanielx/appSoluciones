import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Hash de contraseñas con Argon2id (parámetros OWASP 2024: m=19 MiB, t=2, p=1). */
@Injectable()
export class PasswordService {
  private readonly options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
  private dummyHash: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return argon2.hash(password, this.options);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Verificación contra un hash ficticio para igualar tiempos cuando el usuario no existe. */
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-1');
    await this.verify(await this.dummyHash, password);
  }
}
