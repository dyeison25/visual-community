# Inventario de archivos

Inventario de la implementación, sin dependencias instaladas, builds, logs ni archivos privados. No existe un repositorio Git inicial para producir un diff; la clasificación se basa en la inspección previa a los cambios.

La ampliación del 15 de septiembre de 2026 tiene su [inventario incremental de archivos](CAMBIOS_SEPTIEMBRE_2026.md). La lista siguiente conserva la referencia de la primera versión.

## Creados

- [.gitignore](../.gitignore)
- [Backend/.env.example](../Backend/.env.example)
- [Backend/scripts/deploy-firestore.ts](../Backend/scripts/deploy-firestore.ts)
- [Backend/scripts/firebase-web-config.ts](../Backend/scripts/firebase-web-config.ts)
- [Backend/scripts/prepare-firestore.ts](../Backend/scripts/prepare-firestore.ts)
- [Backend/scripts/test-support.ts](../Backend/scripts/test-support.ts)
- [Backend/src/middleware/auth.middleware.ts](../Backend/src/middleware/auth.middleware.ts)
- [Backend/src/middleware/rate-limit.middleware.ts](../Backend/src/middleware/rate-limit.middleware.ts)
- [Backend/src/routes/energy.routes.ts](../Backend/src/routes/energy.routes.ts)
- [Backend/src/routes/profile.routes.ts](../Backend/src/routes/profile.routes.ts)
- [Backend/src/services/creg/creg.service.ts](../Backend/src/services/creg/creg.service.ts)
- [Backend/src/services/external/http.ts](../Backend/src/services/external/http.ts)
- [Backend/src/services/minenergia/articles.ts](../Backend/src/services/minenergia/articles.ts)
- [Backend/src/services/minenergia/minenergia.service.ts](../Backend/src/services/minenergia/minenergia.service.ts)
- [Backend/src/services/user-metrics.service.ts](../Backend/src/services/user-metrics.service.ts)
- [Backend/src/services/xm/xm.service.ts](../Backend/src/services/xm/xm.service.ts)
- [Backend/tests/auth.test.ts](../Backend/tests/auth.test.ts)
- [Backend/tests/external.test.ts](../Backend/tests/external.test.ts)
- [bun.lock](../bun.lock)
- [docs/ARCHIVOS.md](../docs/ARCHIVOS.md)
- [docs/ARQUITECTURA.md](../docs/ARQUITECTURA.md)
- [docs/FUNCIONES_PRINCIPALES.md](../docs/FUNCIONES_PRINCIPALES.md)
- [docs/FUENTES_OFICIALES.md](../docs/FUENTES_OFICIALES.md)
- [docs/VERIFICACION.md](../docs/VERIFICACION.md)
- [firebase.json](../firebase.json)
- [firestore.indexes.json](../firestore.indexes.json)
- [firestore.rules](../firestore.rules)
- [Frontend/.env](../Frontend/.env)
- [Frontend/.env.example](../Frontend/.env.example)
- [Frontend/bun.lock](../Frontend/bun.lock)
- [Frontend/index.html](../Frontend/index.html)
- [Frontend/package.json](../Frontend/package.json)
- [Frontend/public/favicon.svg](../Frontend/public/favicon.svg)
- [Frontend/src/App.tsx](../Frontend/src/App.tsx)
- [Frontend/src/components/ActivityStats.tsx](../Frontend/src/components/ActivityStats.tsx)
- [Frontend/src/components/ArticleDialog.tsx](../Frontend/src/components/ArticleDialog.tsx)
- [Frontend/src/components/Brand.tsx](../Frontend/src/components/Brand.tsx)
- [Frontend/src/components/EnergyIllustration.tsx](../Frontend/src/components/EnergyIllustration.tsx)
- [Frontend/src/components/Layout.tsx](../Frontend/src/components/Layout.tsx)
- [Frontend/src/components/Metrics.tsx](../Frontend/src/components/Metrics.tsx)
- [Frontend/src/components/UI.tsx](../Frontend/src/components/UI.tsx)
- [Frontend/src/config/firebase.ts](../Frontend/src/config/firebase.ts)
- [Frontend/src/context/AuthContext.tsx](../Frontend/src/context/AuthContext.tsx)
- [Frontend/src/hooks/useResource.ts](../Frontend/src/hooks/useResource.ts)
- [Frontend/src/main.tsx](../Frontend/src/main.tsx)
- [Frontend/src/pages/AuthPage.tsx](../Frontend/src/pages/AuthPage.tsx)
- [Frontend/src/pages/CommunitiesPage.tsx](../Frontend/src/pages/CommunitiesPage.tsx)
- [Frontend/src/pages/Dashboard.tsx](../Frontend/src/pages/Dashboard.tsx)
- [Frontend/src/pages/PrivacyPage.tsx](../Frontend/src/pages/PrivacyPage.tsx)
- [Frontend/src/pages/ProfilePage.tsx](../Frontend/src/pages/ProfilePage.tsx)
- [Frontend/src/pages/RegulationsPage.tsx](../Frontend/src/pages/RegulationsPage.tsx)
- [Frontend/src/pages/SectorPage.tsx](../Frontend/src/pages/SectorPage.tsx)
- [Frontend/src/services/api.ts](../Frontend/src/services/api.ts)
- [Frontend/src/services/energyService.ts](../Frontend/src/services/energyService.ts)
- [Frontend/src/services/errors.ts](../Frontend/src/services/errors.ts)
- [Frontend/src/services/interactionService.ts](../Frontend/src/services/interactionService.ts)
- [Frontend/src/services/profileService.ts](../Frontend/src/services/profileService.ts)
- [Frontend/src/styles.css](../Frontend/src/styles.css)
- [Frontend/tsconfig.json](../Frontend/tsconfig.json)
- [Frontend/vite.config.ts](../Frontend/vite.config.ts)
- [package.json](../package.json)
- [playwright.config.ts](../playwright.config.ts)
- [README.md](../README.md)
- [scripts/dev.ts](../scripts/dev.ts)
- [scripts/verify-ui.mjs](../scripts/verify-ui.mjs)
- [shared/models.ts](../shared/models.ts)
- [shared/validation.ts](../shared/validation.ts)
- [tests/e2e/platform.spec.ts](../tests/e2e/platform.spec.ts)
- [tests/firestore.rules.test.ts](../tests/firestore.rules.test.ts)

## Originales modificados

- [Backend/package.json](../Backend/package.json)
- [Backend/bun.lock](../Backend/bun.lock)
- [Backend/tsconfig.json](../Backend/tsconfig.json)
- [Backend/index.ts](../Backend/index.ts)
- [Backend/src/app.ts](../Backend/src/app.ts)
- [Backend/src/config/auth.config.ts](../Backend/src/config/auth.config.ts)
- [Backend/src/config/firebase.config.ts](../Backend/src/config/firebase.config.ts)
- [Backend/src/services/auth.service.ts](../Backend/src/services/auth.service.ts)
- [Backend/src/controllers/auth.controller.ts](../Backend/src/controllers/auth.controller.ts)
- [Backend/src/routes/auth.routes.ts](../Backend/src/routes/auth.routes.ts)
- [Backend/README.md](../Backend/README.md)

## Conservados

- Backend/.env: valores originales preservados.
- Backend/firebase-service-account.json: cuenta privada existente, no reproducida ni enviada al navegador.
- Backend/.gitignore.
- La configuración Prisma mencionada en etapas anteriores ya no existe en la copia actual.

La dependencia energy-community-auth-sdk se retiró del manifiesto y lockfile. No se eliminaron archivos de código originales.

## Artefactos locales generados

- Frontend/dist: build de producción.
- playwright-report y test-results: informes de pruebas.
- artifacts: capturas, logs, PID de ejecución y copia de reglas anterior a la publicación.

Estos artefactos y los archivos de entorno privados están excluidos por .gitignore.
