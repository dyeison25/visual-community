// Inventario estático conservador. Un candidato NO autoriza su eliminación.
import ts from "../Frontend/node_modules/typescript/lib/typescript.js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
const root = resolve(import.meta.dirname, "..");
const files = [];
function walk(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (["node_modules", "dist", "artifacts", ".git"].includes(entry.name)) continue;
    const path = resolve(folder, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(?:tsx?|mjs)$/.test(path)) files.push(path);
  }
}
for (const dir of ["Backend/src", "Backend/scripts", "Backend/tests", "Frontend/src", "shared", "scripts", "tests"]) walk(resolve(root, dir));
for (const file of ["Backend/index.ts", "Frontend/vite.config.ts", "playwright.config.ts"]) files.push(resolve(root, file));
const options = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, allowJs: true, skipLibCheck: true, baseUrl: resolve(root, "Backend"), paths: { "@/*": ["src/*"] } };
const incoming = new Map(files.map(file => [file, []]));
const imports = new Map();
const dynamic = [];
const unresolved = [];
const host = { ...ts.sys, getCurrentDirectory: () => root };
for (const file of files) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const modules = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) modules.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === "require")) {
      if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) modules.push(node.arguments[0].text);
      else dynamic.push(relative(root, file));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const name of modules) {
    if (!imports.has(name)) imports.set(name, []);
    imports.get(name).push(relative(root, file));
    const result = ts.resolveModuleName(name, file, options, host).resolvedModule;
    if (result && incoming.has(resolve(result.resolvedFileName))) incoming.get(resolve(result.resolvedFileName)).push(relative(root, file));
    else if (!result && name.startsWith(".") && !/\.(css|svg)$/.test(name)) unresolved.push({ file: relative(root, file), name });
  }
}
const standalone = [...incoming].filter(([, refs]) => !refs.length).map(([file]) => relative(root, file));
const packages = {};
for (const dir of ["", "Backend", "Frontend"]) {
  const manifest = JSON.parse(readFileSync(resolve(root, dir, "package.json"), "utf8"));
  packages[dir || "root"] = Object.fromEntries(Object.keys(manifest.dependencies || {}).map(name => [name, [...imports].filter(([specifier]) => specifier === name || specifier.startsWith(name + "/")).flatMap(([, refs]) => refs)]));
}
// Exportados no referenciados: solo candidatos, revisar entradas, contratos y documentación.
const service = ts.createLanguageService({
  ...host, getCompilationSettings: () => options, getScriptFileNames: () => files,
  getScriptVersion: () => "0", getScriptSnapshot: file => existsSync(file) ? ts.ScriptSnapshot.fromString(readFileSync(file, "utf8")) : undefined,
  getDefaultLibFileName: o => ts.getDefaultLibFilePath(o),
});
const exportsWithoutReferences = [];
if (process.argv.includes("--exports")) for (const file of files.filter(file => /[\\/](src|shared)[\\/]/.test(file))) {
  const ast = service.getProgram()?.getSourceFile(file); if (!ast) continue;
  for (const statement of ast.statements) {
    if (!statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const names = ts.isVariableStatement(statement) ? statement.declarationList.declarations.map(d => d.name) : [statement.name];
    for (const name of names.filter(name => name && ts.isIdentifier(name))) {
      const references = service.findReferences(file, name.getStart(ast))?.flatMap(group => group.references.filter(ref => !ref.isDefinition)) || [];
      if (!references.length) exportsWithoutReferences.push({ file: relative(root, file), name: name.text });
    }
  }
}
console.log(JSON.stringify({ files: files.length, standalone, dynamic: [...new Set(dynamic)], unresolved, packages, exportsWithoutReferences }, null, 2));
