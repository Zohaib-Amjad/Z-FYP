import fs from 'fs';
import path from 'path';
import { loadSpec } from './postman';

type Node = Record<string, unknown>;

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const lookup = (spec: Node, ref: string): Node => {
  let current: unknown = spec;
  for (const part of ref.replace(/^#\//, '').split('/')) {
    current = isNode(current) ? current[part] : undefined;
  }
  if (!isNode(current)) throw new Error(`Unresolved reference ${ref}`);
  return current;
};

const resolve = (spec: Node, node: unknown): Node => {
  let current = node;
  while (isNode(current) && typeof current.$ref === 'string') current = lookup(spec, current.$ref);
  return isNode(current) ? current : {};
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const oneLine = (value: string): string => value.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|');

/** Who may call a route, mirroring how the API mounts its middleware. */
export const accessFor = (method: string, route: string, publicOperation: boolean): string => {
  if (publicOperation) return 'Public (no sign-in)';
  if (route.startsWith('/api/admin/') || route.startsWith('/api/staff')) return 'Staff only';
  if (route.startsWith('/api/bookings')) return 'Customer only';
  void method;
  return 'Any signed-in user';
};

const schemaType = (spec: Node, schema: unknown): string => {
  if (isNode(schema) && typeof schema.$ref === 'string')
    return schema.$ref.split('/').pop() ?? 'object';
  const node = resolve(spec, schema);
  const type = text(node.type) || 'object';
  const format = text(node.format);
  const values = Array.isArray(node.enum) ? ` (one of ${node.enum.join(', ')})` : '';
  return `${type}${format ? `, ${format}` : ''}${values}`;
};

const json = (value: unknown): string => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;

const parameterRows = (spec: Node, operation: Node): string[] => {
  const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
  return parameters.map(item => {
    const parameter = resolve(spec, item);
    const description = oneLine(text(parameter.description));
    return `| \`${text(parameter.name)}\` | ${text(parameter.in)} | ${parameter.required ? 'yes' : 'no'} | ${schemaType(spec, parameter.schema)} | ${description} |`;
  });
};

const bodyLines = (spec: Node, operation: Node): string[] => {
  if (!operation.requestBody) return [];
  const body = resolve(spec, operation.requestBody);
  const content = isNode(body.content) ? body.content : {};
  const lines: string[] = ['', '**Request body**', ''];
  for (const [mediaType, media] of Object.entries(content)) {
    const node = isNode(media) ? media : {};
    lines.push(`Content type: \`${mediaType}\`${body.required ? ' (required)' : ''}`, '');
    const schema = resolve(spec, node.schema);
    const properties = isNode(schema.properties) ? schema.properties : {};
    const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
    if (Object.keys(properties).length > 0) {
      lines.push('| Field | Required | Type | Notes |', '| --- | --- | --- | --- |');
      for (const [field, definition] of Object.entries(properties)) {
        const detail = resolve(spec, definition);
        lines.push(
          `| \`${field}\` | ${required.has(field) ? 'yes' : 'no'} | ${schemaType(spec, definition)} | ${oneLine(text(detail.description))} |`,
        );
      }
      lines.push('');
    }
    if (node.example !== undefined) lines.push('Example:', '', json(node.example), '');
  }
  return lines;
};

const responseLines = (spec: Node, operation: Node): string[] => {
  const responses = isNode(operation.responses) ? operation.responses : {};
  const rows: string[] = [];
  let example: unknown;
  for (const [status, ref] of Object.entries(responses)) {
    const response = resolve(spec, ref);
    rows.push(`| ${status} | ${oneLine(text(response.description))} |`);
    if (example === undefined && /^2/.test(status)) {
      const content = isNode(response.content) ? response.content : {};
      const media = Object.values(content)[0];
      if (isNode(media)) example = media.example;
    }
  }
  const lines = ['', '**Responses**', '', '| Status | Meaning |', '| --- | --- |', ...rows];
  if (example !== undefined) lines.push('', 'Example success response:', '', json(example));
  return lines;
};

/** Markdown reference of every operation in the OpenAPI document, grouped by tag. */
export const buildApiReference = (spec: Node = loadSpec()): string => {
  const info = resolve(spec, spec.info);
  const tags = (Array.isArray(spec.tags) ? spec.tags : []).map(tag =>
    text(resolve(spec, tag).name),
  );
  const paths = resolve(spec, spec.paths);

  interface Entry {
    method: string;
    route: string;
    operation: Node;
  }
  const byTag = new Map<string, Entry[]>(tags.map(tag => [tag, []]));
  for (const [route, item] of Object.entries(paths)) {
    const pathItem = resolve(spec, item);
    for (const method of METHODS) {
      const operation = pathItem[method];
      if (!isNode(operation)) continue;
      const tag = Array.isArray(operation.tags) ? text(operation.tags[0]) : 'Other';
      byTag.set(tag, [...(byTag.get(tag) ?? []), { method, route, operation }]);
    }
  }

  const total = [...byTag.values()].reduce((sum, entries) => sum + entries.length, 0);
  const out: string[] = [
    '# API reference',
    '',
    `Generated from \`api/openapi.yaml\` by \`npm run docs:api --workspace=api\`; do not edit by hand. ${total} operations, version ${text(info.version)}.`,
    '',
    '**Interactive documentation:** with the API running in development, open <http://localhost:4000/api/docs> (Swagger UI). It is not served in production.',
    '',
    '**Base URLs:** `http://localhost:4000` (the API directly) and `http://localhost:3000` (through the web application, which is what the browser uses so that cookies stay same-origin).',
    '',
    text(info.description)
      .split('\n')
      .map(line => line.replace(/^ {4}/, ''))
      .join('\n'),
    '',
    '## Contents',
    '',
    '| Group | Operations |',
    '| --- | ---: |',
    ...[...byTag.entries()]
      .filter(([, entries]) => entries.length > 0)
      .map(
        ([tag, entries]) =>
          `| [${tag}](#${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}) | ${entries.length} |`,
      ),
    '',
  ];

  for (const [tag, entries] of byTag) {
    if (entries.length === 0) continue;
    out.push(`## ${tag}`, '');
    for (const { method, route, operation } of entries) {
      const publicOperation = Array.isArray(operation.security) && operation.security.length === 0;
      out.push(`### ${method.toUpperCase()} \`${route}\``, '', text(operation.summary), '');
      out.push(`Access: **${accessFor(method, route, publicOperation)}**`, '');
      const description = text(operation.description);
      if (description) out.push(description.replace(/\n {8}/g, '\n'), '');
      const rows = parameterRows(spec, operation);
      if (rows.length > 0) {
        out.push(
          '**Parameters**',
          '',
          '| Name | In | Required | Type | Description |',
          '| --- | --- | --- | --- | --- |',
          ...rows,
          '',
        );
      }
      out.push(...bodyLines(spec, operation), ...responseLines(spec, operation), '');
    }
  }
  return `${out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
};

export const REFERENCE_PATH = path.resolve(__dirname, '..', '..', 'docs', 'api-reference.md');

if (require.main === module) {
  fs.writeFileSync(REFERENCE_PATH, buildApiReference());
  console.log(`Wrote ${path.relative(process.cwd(), REFERENCE_PATH)}`);
}
