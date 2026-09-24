import { Body, Query, applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z, type ZodObject, type ZodType } from 'zod';
import { ZodValidationPipe } from './zod.pipe';

type JsonSchema = Record<string, unknown>;

/** JSON Schema (OpenAPI 3.1 compatible) derivado del esquema Zod compartido. */
export function toJsonSchema(schema: ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
  delete json.$schema;
  return json;
}

/** Valida el body con el esquema Zod compartido. */
export const ZBody = (schema: ZodType) => Body(new ZodValidationPipe(schema));

/** Valida el query string con el esquema Zod compartido. */
export const ZQuery = (schema: ZodType) => Query(new ZodValidationPipe(schema));

/** Documenta el body en OpenAPI a partir del esquema Zod. */
export const ApiZodBody = (schema: ZodType, description?: string) =>
  ApiBody({ schema: toJsonSchema(schema) as never, description });

/** Documenta cada parámetro de query en OpenAPI. */
export function ApiZodQuery(schema: ZodObject) {
  const json = toJsonSchema(schema) as { properties?: Record<string, JsonSchema>; required?: string[] };
  const decorators = Object.entries(json.properties ?? {}).map(([name, prop]) =>
    ApiQuery({ name, required: json.required?.includes(name) ?? false, schema: prop as never }),
  );
  return applyDecorators(...decorators);
}
