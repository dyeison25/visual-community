import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";

const root = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
// Git evalúa los patrones en un repositorio temporal vacío. No se copian secretos.
function ignored(patterns: string, paths: string[]) {
  const directory = mkdtempSync(resolve(tmpdir(), "vc-ignore-check-"));
  try {
    const initialized = spawnSync("git", ["init", "--quiet", directory], { encoding: "utf8" });
    if (initialized.status !== 0) throw Error("Esta verificación requiere Git disponible.");
    writeFileSync(resolve(directory, ".gitignore"), patterns);
    const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", "--stdin"], {
      cwd: directory, input: paths.join("\n") + "\n", encoding: "utf8",
    });
    if (result.status !== 0 && result.status !== 1) throw Error("No se pudieron verificar los patrones.");
    return new Set(result.stdout.trim().split(/\r?\n/).filter(Boolean));
  } finally {
    // Solo eliminar el directorio temporal creado por esta función.
    if (dirname(directory) !== resolve(tmpdir()) || !directory.startsWith(resolve(tmpdir(), "vc-ignore-check-"))) {
      throw Error("Ruta temporal inesperada.");
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

const privateFiles = ["Backend/firebase-service-account.json", "Backend/local-firebase-adminsdk-test.json",
  "Backend/service-account-test.json", "Backend/.env", "Frontend/.env", "Backend/certificate.pem", "Backend/private.key"];

describe("Estructura canónica y exclusión de credenciales", () => {
  test("Git excluye secretos, dependencias y artefactos, pero conserva fuentes y ejemplos", () => {
    const excluded = [...privateFiles, "node_modules/example/a.js", "Backend/node_modules/example/a.js",
      "Frontend/node_modules/example/a.js", "Backend/dist/index.js", "Frontend/dist/index.html",
      "Backend/out/a.js", "Backend/src/.cache/result", "Backend/logs/error.txt", "Backend/.idea/settings.xml",
      "Backend/package.tgz", "Backend/coverage.lcov", "artifacts/result.json"];
    const included = ["Backend/.env.example", "Frontend/.env.example", "Backend/src/app.ts",
      "Backend/package.json", "Backend/bun.lock", "package.json", "bun.lock", "firestore.rules", "firestore.indexes.json"];
    const result = ignored(read(".gitignore"), [...excluded, ...included]);
    for (const path of excluded) expect(result.has(path)).toBe(true);
    for (const path of included) expect(result.has(path)).toBe(false);
    expect(existsSync(resolve(root, "Backend/.gitignore"))).toBe(false);
  });

  test("Cloud Build reutiliza la lista Docker y excluye archivos privados y herramientas", () => {
    const cloudDirectives = read(".gcloudignore").split(/\r?\n/).map(line => line.trim())
      .filter(line => line && (!line.startsWith("#") || line.startsWith("#!")));
    expect(cloudDirectives).toEqual(["#!include:.dockerignore"]);
    // gcloud inserta estos mismos patrones según su directiva oficial include.
    const excluded = [...privateFiles, "Backend/src/secret-service-account.json", "shared/private.key",
      "Backend/src/.env", "node_modules/a.js", "Backend/node_modules/a.js", "Frontend/package.json",
      "Backend/scripts/test-support.ts", "Backend/tests/auth.test.ts", "scripts/dev.ts", "tests/packaging.test.ts",
      "artifacts/result.json", "docs/PRODUCCION.md", "Backend/dist/index.js"];
    const included = ["Dockerfile", ".dockerignore", "Backend/package.json", "Backend/bun.lock",
      "Backend/tsconfig.json", "Backend/index.ts", "Backend/src/app.ts", "shared/models.ts"];
    const result = ignored(read(".dockerignore"), [...excluded, ...included]);
    for (const path of excluded) expect(result.has(path)).toBe(true);
    for (const path of included) expect(result.has(path)).toBe(false);
  });

  test("Firebase apunta a una única configuración de reglas e índices en la raíz", () => {
    const config = JSON.parse(read("firebase.json"));
    expect(config.firestore).toEqual({ rules: "firestore.rules", indexes: "firestore.indexes.json" });
    for (const file of ["firebase.json", "firestore.rules", "firestore.indexes.json"]) {
      expect(existsSync(resolve(root, file))).toBe(true);
      expect(existsSync(resolve(root, "Backend", file))).toBe(false);
    }
  });
});
