import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'contracts/generated/social-route-inventory.json');
const roots = ['apps/backend/src', 'apps/orchestrator/src'];
const methods = new Map([
  ['Get', 'GET'],
  ['Post', 'POST'],
  ['Put', 'PUT'],
  ['Patch', 'PATCH'],
  ['Delete', 'DELETE'],
  ['Head', 'HEAD'],
  ['Options', 'OPTIONS'],
]);

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? filesUnder(path)
      : entry.isFile() && entry.name.endsWith('.ts')
      ? [path]
      : [];
  });
}

function decorators(node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
}

function decoratorCall(decorator) {
  const expression = decorator.expression;
  if (!ts.isCallExpression(expression)) return null;
  const name = ts.isIdentifier(expression.expression)
    ? expression.expression.text
    : null;
  return name ? { name, arguments: expression.arguments } : null;
}

function decoratorNames(node) {
  return decorators(node)
    .map(decoratorCall)
    .flatMap((call) => (call ? [call.name] : []));
}

function literalArgument(call, fallback = '') {
  const argument = call?.arguments?.[0];
  if (!argument) return fallback;
  if (
    ts.isStringLiteral(argument) ||
    ts.isNoSubstitutionTemplateLiteral(argument)
  ) {
    return argument.text;
  }
  if (ts.isArrayLiteralExpression(argument)) {
    return argument.elements.flatMap((element) =>
      ts.isStringLiteral(element) ? [element.text] : []
    );
  }
  throw new Error(
    `Route decorator requires a literal path: ${argument.getText()}`
  );
}

function normalizePath(controllerPath, methodPath) {
  const parts = [controllerPath, methodPath]
    .flat()
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${parts.join('/')}`.replace(/\/+/g, '/') || '/';
}

const routes = [];
for (const sourcePath of roots.flatMap((directory) =>
  filesUnder(resolve(root, directory))
)) {
  const source = ts.createSourceFile(
    sourcePath,
    readFileSync(sourcePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  source.forEachChild((node) => {
    if (!ts.isClassDeclaration(node) || !node.name) return;
    const controller = decorators(node)
      .map(decoratorCall)
      .find((call) => call?.name === 'Controller');
    if (!controller) return;
    const controllerPaths = [literalArgument(controller, '')].flat();
    const controllerDecorators = decoratorNames(node)
      .filter((name) => name !== 'Controller')
      .sort();
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || !member.name) continue;
      const handlerDecorators = decoratorNames(member)
        .filter((name) => !methods.has(name))
        .sort();
      const parameterDecorators = [
        ...new Set(
          member.parameters.flatMap((parameter) => decoratorNames(parameter))
        ),
      ].sort();
      for (const call of decorators(member).map(decoratorCall)) {
        const method = call && methods.get(call.name);
        if (!method) continue;
        const methodPaths = [literalArgument(call, '')].flat();
        for (const controllerPath of controllerPaths) {
          for (const methodPath of methodPaths) {
            routes.push({
              method,
              path: normalizePath(controllerPath, methodPath),
              controller: node.name.text,
              handler: member.name.getText(source),
              source: relative(root, sourcePath),
              controller_decorators: controllerDecorators,
              handler_decorators: handlerDecorators,
              parameter_decorators: parameterDecorators,
            });
          }
        }
      }
    }
  });
}

routes.sort((left, right) =>
  `${left.path} ${left.method} ${left.controller} ${left.handler}`.localeCompare(
    `${right.path} ${right.method} ${right.controller} ${right.handler}`
  )
);
const duplicates = routes.filter(
  (route, index) =>
    index > 0 &&
    route.method === routes[index - 1].method &&
    route.path === routes[index - 1].path
);
if (duplicates.length) {
  throw new Error(
    `Duplicate route authority: ${duplicates
      .map((route) => `${route.method} ${route.path}`)
      .join(', ')}`
  );
}

const document = `${JSON.stringify(
  {
    schema_version: 1,
    generated_from: roots,
    route_count: routes.length,
    routes,
  },
  null,
  2
)}\n`;

if (process.argv.includes('--check')) {
  const current = readFileSync(output, 'utf8');
  if (current !== document) {
    throw new Error(
      'Route inventory is stale; run pnpm contracts:routes:generate'
    );
  }
  console.log(`Social route inventory is current (${routes.length} routes)`);
} else {
  writeFileSync(output, document);
  console.log(`Wrote ${relative(root, output)} (${routes.length} routes)`);
}
