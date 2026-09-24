/**
 * Datos demostrativos realistas para desarrollo. Las contraseñas aquí documentadas
 * son SOLO para el entorno development (ver README).
 * Ejecutar: pnpm db:seed (idempotente: no duplica registros existentes).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEV_PASSWORD = 'Mecaelectric2026';

async function hash(p: string) {
  return argon2.hash(p, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

async function upsertUser(email: string, fullName: string, role: 'ADMIN' | 'COORDINATOR' | 'TECHNICIAN', extra: Partial<Prisma.UserCreateInput> = {}) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, fullName, role, passwordHash: await hash(DEV_PASSWORD), ...extra },
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de demostración no debe ejecutarse en producción.');
  }

  await upsertUser('admin@mecaelectric.local', 'María Gómez', 'ADMIN', { jobTitle: 'Directora de operaciones', phone: '604 444 1020' });
  await upsertUser('coordinador@mecaelectric.local', 'Andrés Restrepo', 'COORDINATOR', { jobTitle: 'Coordinador de servicios', phone: '310 555 0142' });
  await upsertUser('tecnico@mecaelectric.local', 'Juan Pérez', 'TECHNICIAN', { jobTitle: 'Técnico electromecánico', phone: '315 555 0199' });
  await upsertUser('tecnico2@mecaelectric.local', 'Carlos Muñoz', 'TECHNICIAN', { jobTitle: 'Técnico mecánico', phone: '318 555 0177' });

  // Empresa principal y una aliada
  const meca = await prisma.brandProfile.findFirst({ where: { isDefault: true } }) ??
    await prisma.brandProfile.create({
      data: {
        name: 'MECAELECTRIC',
        legalName: 'MECAELECTRIC S.A.S.',
        nit: '901234567',
        address: 'Cra. 50 # 30-45, Itagüí, Antioquia',
        phone: '604 444 1020',
        email: 'servicios@mecaelectric.com.co',
        website: 'https://mecaelectric.com.co',
        primaryColor: '#0B1F33',
        secondaryColor: '#E85D04',
        footerText: 'MECAELECTRIC S.A.S. · Mantenimiento industrial mecánico y eléctrico',
        isDefault: true,
      },
    });
  if (!(await prisma.brandProfile.findFirst({ where: { name: 'Compresores Antioquia' } }))) {
    await prisma.brandProfile.create({
      data: {
        name: 'Compresores Antioquia',
        legalName: 'Compresores Antioquia S.A.S.',
        nit: '900876543',
        address: 'Calle 10 Sur # 48-20, Medellín',
        phone: '604 322 9080',
        email: 'servicio@compresoresantioquia.com.co',
        primaryColor: '#1F3A5F',
        secondaryColor: '#1769AA',
        footerText: 'Servicio ejecutado por MECAELECTRIC S.A.S. en representación de Compresores Antioquia S.A.S.',
      },
    });
  }

  const serviceTypes = [
    { code: 'MP', name: 'Mantenimiento preventivo', description: 'Rutina programada según plan de mantenimiento', requiresEquipment: true },
    { code: 'MC', name: 'Mantenimiento correctivo', description: 'Atención de falla reportada', requiresEquipment: true },
    { code: 'DIAG', name: 'Diagnóstico e inspección', description: 'Evaluación técnica del equipo', requiresEquipment: true },
    { code: 'INST', name: 'Visita técnica general', description: 'Levantamiento o visita sin equipo específico', requiresEquipment: false },
  ];
  for (const st of serviceTypes) {
    await prisma.serviceType.upsert({ where: { code: st.code }, update: {}, create: st });
  }
  const mp = await prisma.serviceType.findUniqueOrThrow({ where: { code: 'MP' } });
  const diag = await prisma.serviceType.findUniqueOrThrow({ where: { code: 'DIAG' } });

  // Plantillas
  if (!(await prisma.checklistTemplate.findFirst({ where: { name: 'Preventivo compresor de tornillo' } }))) {
    await prisma.checklistTemplate.create({
      data: {
        name: 'Preventivo compresor de tornillo',
        description: 'Rutina trimestral para compresores de tornillo lubricados (GA / GX / similares).',
        serviceTypeId: mp.id,
        items: {
          create: [
            { order: 1, section: 'Seguridad', label: 'Bloqueo y etiquetado (LOTO) aplicado', responseType: 'BOOLEAN', required: true },
            { order: 2, section: 'Lubricación', label: 'Verificar nivel de aceite', responseType: 'STATUS', required: true, evidenceRequired: true, minPhotos: 1 },
            { order: 3, section: 'Lubricación', label: 'Horas de operación del aceite', responseType: 'NUMBER', unit: 'h', minValue: 0, maxValue: 4000, required: true },
            { order: 4, section: 'Filtración', label: 'Estado del filtro de aire', responseType: 'STATUS', required: true, evidenceRequired: true, minPhotos: 1 },
            { order: 5, section: 'Filtración', label: 'Elementos reemplazados', responseType: 'MULTISELECT', options: ['Filtro de aire', 'Filtro de aceite', 'Separador', 'Ninguno'], required: true },
            { order: 6, section: 'Operación', label: 'Presión de descarga', responseType: 'NUMBER', unit: 'bar', minValue: 6, maxValue: 8.5, required: true },
            { order: 7, section: 'Operación', label: 'Temperatura de descarga del elemento', responseType: 'NUMBER', unit: '°C', minValue: 70, maxValue: 105, required: true },
            { order: 8, section: 'Eléctrico', label: 'Corriente del motor principal (promedio fases)', responseType: 'NUMBER', unit: 'A', required: true },
            { order: 9, section: 'Eléctrico', label: 'Estado de conexiones y contactores', responseType: 'STATUS', required: true },
            { order: 10, section: 'Estado general', label: 'Fugas de aire o aceite', responseType: 'SELECT', options: ['Sin fugas', 'Fuga menor', 'Fuga significativa'], required: true },
            { order: 11, section: 'Estado general', label: 'Fotografía de placa del equipo', responseType: 'BOOLEAN', required: true, evidenceRequired: true, minPhotos: 1, description: 'Confirme que la placa es legible y tome la fotografía.' },
          ],
        },
      },
    });
  }
  if (!(await prisma.checklistTemplate.findFirst({ where: { name: 'Inspección motor eléctrico' } }))) {
    await prisma.checklistTemplate.create({
      data: {
        name: 'Inspección motor eléctrico',
        description: 'Diagnóstico de motores de inducción trifásicos.',
        serviceTypeId: diag.id,
        items: {
          create: [
            { order: 1, section: 'Mediciones', label: 'Resistencia de aislamiento (megger 500 V)', responseType: 'NUMBER', unit: 'MΩ', minValue: 100, required: true },
            { order: 2, section: 'Mediciones', label: 'Temperatura de carcasa', responseType: 'NUMBER', unit: '°C', maxValue: 80, required: true },
            { order: 3, section: 'Mediciones', label: 'Vibración en rodamiento lado acople', responseType: 'NUMBER', unit: 'mm/s', maxValue: 4.5, required: true },
            { order: 4, section: 'Inspección', label: 'Estado del motor', responseType: 'STATUS', required: true, evidenceRequired: true, minPhotos: 1 },
            { order: 5, section: 'Inspección', label: 'Ruido anormal en rodamientos', responseType: 'BOOLEAN', required: true },
            { order: 6, section: 'Inspección', label: 'Observaciones de la caja de conexiones', responseType: 'LONG_TEXT', required: false },
          ],
        },
      },
    });
  }

  // Clientes y equipos
  const andinas = await prisma.client.upsert({
    where: { nit: '900456789' },
    update: {},
    create: {
      legalName: 'Industrias Andinas S.A.S.',
      tradeName: 'Andinas',
      nit: '900456789',
      dv: '3',
      contactName: 'Luisa Fernanda Ortiz',
      phone: '604 360 2211',
      email: 'mantenimiento@industriasandinas.com.co',
      address: 'Autopista Sur # 32-150',
      city: 'Medellín',
      department: 'Antioquia',
    },
  });
  const norte = await prisma.client.upsert({
    where: { nit: '800123456' },
    update: {},
    create: {
      legalName: 'Alimentos del Norte S.A.S.',
      tradeName: 'Alinorte',
      nit: '800123456',
      dv: '7',
      contactName: 'Jorge Iván Cárdenas',
      phone: '605 385 7700',
      email: 'jefe.mantenimiento@alinorte.com.co',
      address: 'Vía 40 # 85-12, Zona Industrial',
      city: 'Barranquilla',
      department: 'Atlántico',
    },
  });

  const equipment = [
    { clientId: andinas.id, code: 'MP-001', name: 'Compresor de tornillo', category: 'Aire comprimido', brand: 'Atlas Copco', model: 'GA30', serial: 'API123456', location: 'Planta Medellín / área de producción' },
    { clientId: andinas.id, code: 'MP-002', name: 'Motor eléctrico 25 HP', category: 'Motores', brand: 'Siemens', model: '1LE1001-1CB23', serial: 'SIE-25HP-0098', location: 'Planta Medellín / molino 2' },
    { clientId: norte.id, code: 'MP-003', name: 'Bomba centrífuga', category: 'Bombeo', brand: 'Grundfos', model: 'NB 65-200', serial: 'GF-NB65-55120', location: 'Planta Barranquilla / cuarto de bombas' },
  ];
  for (const e of equipment) {
    await prisma.equipment.upsert({ where: { clientId_code: { clientId: e.clientId, code: e.code } }, update: {}, create: e });
  }

  // eslint-disable-next-line no-console
  console.log(`Seed completo. Empresa principal: ${meca.legalName}. Contraseña de desarrollo: ${DEV_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
