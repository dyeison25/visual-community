import { expect, test } from "bun:test";
import { allowedOrigins } from "../src/config/auth.config";
import { validateProductionEnvironment } from "../src/config/production.config";

const valid = { NODE_ENV: "production", FIREBASE_PROJECT_ID: "fixture-project", FRONTEND_ORIGIN: "https://fixture.web.app", ALGOLIA_APP_ID: "fixture", ALGOLIA_SEARCH_API_KEY: "fixture", ALGOLIA_INDEX_NAME: "fixture", GEMINI_API_KEY: "fixture", GEMINI_MODEL: "fixture" };
test("producción exige configuración y rechaza emuladores sin mostrar valores", () => {
  expect(() => validateProductionEnvironment(valid)).not.toThrow();
  expect(() => validateProductionEnvironment({ ...valid, GEMINI_API_KEY: "" })).toThrow("GEMINI_API_KEY");
  expect(() => validateProductionEnvironment({ ...valid, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" })).toThrow("emuladores");
  expect(() => validateProductionEnvironment({ ...valid, FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" })).toThrow("emuladores");
  expect(() => validateProductionEnvironment({ ...valid, FIREBASE_PROJECT_ID: "demo-test" })).toThrow("demo");
});
test("CORS de producción permite únicamente orígenes exactos HTTPS", () => {
  expect(allowedOrigins(valid)).toEqual(["https://fixture.web.app"]);
  for (const origin of ["*", "http://fixture.web.app", "https://fixture.web.app/path", "https://fixture.web.app/", "https://user:pass@fixture.web.app", ""]) {
    expect(() => allowedOrigins({ ...valid, FRONTEND_ORIGIN: origin })).toThrow();
  }
  expect(allowedOrigins({ NODE_ENV: "development" })).toContain("http://127.0.0.1:5173");
});
