# Archivos de la ampliación de septiembre de 2026

Cambios incrementales de encuesta, roles, administración y detalle de comunidades. Se excluyen builds, dependencias, capturas y archivos privados.

## Creados (16)

- [Backend/scripts/prepare-profiles.ts](../Backend/scripts/prepare-profiles.ts)
- [Backend/src/middleware/admin.middleware.ts](../Backend/src/middleware/admin.middleware.ts)
- [Backend/src/routes/admin.routes.ts](../Backend/src/routes/admin.routes.ts)
- [Backend/src/services/admin/admin.service.ts](../Backend/src/services/admin/admin.service.ts)
- [Frontend/src/components/AccessRoutes.tsx](../Frontend/src/components/AccessRoutes.tsx)
- [Frontend/src/components/AdminActivity.tsx](../Frontend/src/components/AdminActivity.tsx)
- [Frontend/src/components/CommunityDialog.tsx](../Frontend/src/components/CommunityDialog.tsx)
- [Frontend/src/components/PreferenceFields.tsx](../Frontend/src/components/PreferenceFields.tsx)
- [Frontend/src/pages/AdminPage.tsx](../Frontend/src/pages/AdminPage.tsx)
- [Frontend/src/pages/AdminUserPage.tsx](../Frontend/src/pages/AdminUserPage.tsx)
- [Frontend/src/pages/OnboardingPage.tsx](../Frontend/src/pages/OnboardingPage.tsx)
- [Frontend/src/services/adminService.ts](../Frontend/src/services/adminService.ts)
- [docs/ADMINISTRACION_Y_PREFERENCIAS.md](../docs/ADMINISTRACION_Y_PREFERENCIAS.md)
- [docs/CAMBIOS_SEPTIEMBRE_2026.md](../docs/CAMBIOS_SEPTIEMBRE_2026.md)
- [shared/admin.ts](../shared/admin.ts)
- [shared/preferences.ts](../shared/preferences.ts)

## Modificados (28)

- [Backend/scripts/test-support.ts](../Backend/scripts/test-support.ts)
- [Backend/src/app.ts](../Backend/src/app.ts)
- [Backend/src/routes/profile.routes.ts](../Backend/src/routes/profile.routes.ts)
- [Backend/src/services/minenergia/minenergia.service.ts](../Backend/src/services/minenergia/minenergia.service.ts)
- [Backend/src/services/user-metrics.service.ts](../Backend/src/services/user-metrics.service.ts)
- [Backend/tests/auth.test.ts](../Backend/tests/auth.test.ts)
- [Backend/tests/external.test.ts](../Backend/tests/external.test.ts)
- [Frontend/src/App.tsx](../Frontend/src/App.tsx)
- [Frontend/src/components/ActivityStats.tsx](../Frontend/src/components/ActivityStats.tsx)
- [Frontend/src/components/Layout.tsx](../Frontend/src/components/Layout.tsx)
- [Frontend/src/context/AuthContext.tsx](../Frontend/src/context/AuthContext.tsx)
- [Frontend/src/pages/CommunitiesPage.tsx](../Frontend/src/pages/CommunitiesPage.tsx)
- [Frontend/src/pages/PrivacyPage.tsx](../Frontend/src/pages/PrivacyPage.tsx)
- [Frontend/src/pages/ProfilePage.tsx](../Frontend/src/pages/ProfilePage.tsx)
- [Frontend/src/services/api.ts](../Frontend/src/services/api.ts)
- [Frontend/src/services/interactionService.ts](../Frontend/src/services/interactionService.ts)
- [Frontend/src/services/profileService.ts](../Frontend/src/services/profileService.ts)
- [Frontend/src/styles.css](../Frontend/src/styles.css)
- [README.md](../README.md)
- [docs/ARCHIVOS.md](../docs/ARCHIVOS.md)
- [docs/ARQUITECTURA.md](../docs/ARQUITECTURA.md)
- [docs/FUENTES_OFICIALES.md](../docs/FUENTES_OFICIALES.md)
- [docs/FUNCIONES_PRINCIPALES.md](../docs/FUNCIONES_PRINCIPALES.md)
- [docs/VERIFICACION.md](../docs/VERIFICACION.md)
- [firestore.rules](../firestore.rules)
- [shared/models.ts](../shared/models.ts)
- [tests/e2e/platform.spec.ts](../tests/e2e/platform.spec.ts)
- [tests/firestore.rules.test.ts](../tests/firestore.rules.test.ts)

Se conservan profiles, sus subcolecciones interactions y userMetrics. No se instalaron dependencias ni se modificaron archivos .env o credenciales.

Los respaldos locales anteriores están en artifacts/pre-onboarding-admin con extensión .snapshot; no se ejecutan como código ni como pruebas.

[Configuración y permisos](ADMINISTRACION_Y_PREFERENCIAS.md) · [Verificación](VERIFICACION.md)
