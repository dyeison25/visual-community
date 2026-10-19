# Verificación de Visual Community

Verificación actual: **15 de septiembre de 2026**, sobre la ampliación de encuesta, roles, administración y detalle de comunidades.

## Resultados

| Comprobación | Resultado |
|---|---|
| `npm run dev` | Frontend en 5173 y backend en 3000, con Firebase real |
| `npm run typecheck` | Backend y frontend sin errores |
| `npm run build` | Build de producción correcto |
| Pruebas Bun del backend y servicios | 15 aprobadas |
| Pruebas de reglas Firestore | 10 aprobadas en proyecto demo aislado |
| Playwright con Firebase y Firestore reales | 16 casos únicos aprobados: 8 en escritorio y 8 en móvil |
| Apertura del build final en navegador | Correcta; cero errores JavaScript |
| Revisión de desbordamiento horizontal | Correcta en las pantallas comprobadas |
| Reglas Firestore reales | Publicadas y coincidentes con el archivo local |
| Cuentas temporales al finalizar | Ninguna |
| Conservación del seguimiento anterior | 78 eventos; conteos de perfiles: 56, 22 y 0 |

Se ejecutó primero la suite completa de 14 casos. Después se ejecutaron 6 pruebas dirigidas al refuerzo de confirmación de escritura y permisos: 4 repetidas y 2 nuevas de pérdida de conexión. Por último se repitieron las 2 pruebas de fuentes para revisar las capturas del modal y el contraste. Son **16 casos de navegador distintos**, no 22 funcionalidades distintas.

En conjunto se comprobaron **41 casos distintos** entre backend, reglas y navegador. El informe HTML y `test-results/.last-run.json` corresponden a la última ejecución dirigida, por lo que muestran únicamente sus dos casos. No representan por sí solos el total de las ejecuciones descritas.

## Flujos comprobados contra Firebase real

- Registro con cuenta real desechable y obtención de uid.
- Correo inválido y cuenta duplicada rechazados.
- Encuesta obligatoria después de crear la cuenta, también al intentar abrir otra ruta.
- Rechazo de encuesta sin temas.
- Guardado de temas, formatos y onboardingCompleted en Firestore.
- Recarga, logout y login sin repetir una encuesta completada.
- Error con contraseña incorrecta y acceso con la correcta.
- Regreso a la sección solicitada tras iniciar sesión.
- Mi perfil sin métricas ni historial; edición de nombre y preferencias persistente.
- Registro de SELECT_PREFERENCES y UPDATE_PROFILE.
- Acceso manual a /admin rechazado para un usuario normal.
- APIs administrativas y antigua /api/profile/metrics rechazadas con 403 para un usuario normal.
- Intento directo de cambiar el rol en Firestore rechazado.
- Lectura directa del historial desde una cuenta normal rechazada.
- Administrador temporal: menú, resumen, lista de cuentas y detalle con actividad reciente.
- Retirada del rol admin: redirección de la pantalla y denegación del backend, incluso con resultados en caché.
- Perfiles privados entre dos cuentas y acceso anónimo rechazado.
- Escritura de encuesta sin conexión: no da por completada la encuesta antes de confirmarse. Al recuperar conexión puede terminar el guardado pendiente.
- XM real: indicadores, serie y tabla.
- MinEnergía real: comunidades, búsqueda por municipio y detalle en modal.
- Enlace de comunidad al portal público del Ministerio, sin abrir un endpoint JSON.
- Artículos, normativa y enlaces oficiales con eventos conservados.
- HTTP 503 simulado únicamente en la prueba: otras secciones siguen funcionando.

Las pruebas crean sus propias cuentas `vc-...@example.invalid`. La promoción administrativa se limita a esas cuentas mediante una herramienta que verifica uid y correo; no se cambiaron roles de desarrolladores para probar. La limpieza elimina exclusivamente las cuentas de la ejecución y sus propios perfiles, eventos y métricas.

## Reglas

Las 10 pruebas aisladas verificaron:

- Lectura del perfil propio y rechazo de perfiles ajenos por usuarios normales.
- Creación de perfiles únicamente con role user y encuesta pendiente.
- Rechazo de contraseñas, campos inesperados y privilegios.
- Imposibilidad de elevar o eliminar el rol y de borrar/recrear el perfil desde el cliente.
- Temas válidos y no repetidos; encuesta obligatoria y sin regresión a incompleta.
- Compatibilidad con perfiles anteriores sin perder intereses.
- Ausencia de acceso anónimo.
- Todos los tipos de evento anteriores y nuevos siguen admitidos para el uid propietario.
- Eventos con timestamp del servidor, inmutables y con metadatos limitados.
- Lectura administrativa de perfiles, historial y métricas; denegación para usuarios normales.
- Ni un cliente admin puede alterar eventos, asignar roles o fabricar métricas.
- La revocación del rol se aplica sin cambiar el token de sesión.

Las reglas probadas se publicaron en **Firestore real** y se confirmó su igualdad con `firestore.rules`. Los emuladores usados para las reglas se cerraron después; la aplicación normal no depende de ellos.

## Conservación de datos

La inspección inicial encontró 3 cuentas de Authentication, 2 perfiles y 78 eventos. Después de completar los campos ausentes:

- Se conservan las 3 cuentas.
- Existen 3 perfiles, incluido el que faltaba.
- Se conservan 78 eventos originales, distribuidos en 56, 22 y 0.
- Las tres cuentas mantienen role user. El procedimiento manual de asignación a admin está documentado.
- No quedan cuentas temporales de las pruebas.

La comprobación local sin credenciales ni correos está en `artifacts/verification-data-sept15.json`.

## Revisión visual y ejecución

Se revisaron escritorio de 1440 × 1000 y móvil de 390 × 844. Se conservan sidebar, paleta, tipografía y tarjetas. La tabla administrativa tiene desplazamiento horizontal dentro de su contenedor; no desborda la página.

Capturas locales:

- `artifacts/onboarding-desktop.png` y `onboarding-mobile.png`.
- `artifacts/profile-desktop.png` y `profile-mobile.png`.
- `artifacts/admin-desktop.png` y `admin-mobile.png`.
- `artifacts/admin-user-desktop.png` y `admin-user-mobile.png`.
- `artifacts/community-detail-desktop.png` y `community-detail-mobile.png`.
- Capturas públicas actualizadas de login y registro.

`node scripts/verify-ui.mjs` comprobó la apertura del build compilado con cero errores JavaScript. El servidor temporal de esa prueba se cerró al terminar.

## Límites

- Las dos cuentas de desarrolladores deben asignarse como admin siguiendo [el procedimiento de configuración](ADMINISTRACION_Y_PREFERENCIAS.md); no se asignan por nombre o correo hardcodeado.
- El resumen se reutiliza durante un minuto. Sus frecuencias son una muestra identificada de hasta 20 eventos por perfil; los contadores generales usan todo su historial.
- El coste del resumen crece con las cuentas/perfiles. Para una población grande se recomienda implementar agregados incrementales antes de ampliar la carga.
- Los eventos provienen del cliente y no constituyen una prueba antifraude ni un motor de permanencia.
- Una interrupción de conexión o cierre del navegador puede impedir entregar eventos pendientes. Guardar el perfil y registrar su evento son operaciones separadas.
- CREG continúa como catálogo editorial; no se sustituyó por una API ficticia.
- El esquema revisado de MinEnergía no ofrece una página pública individual verificada; el enlace lleva a su portal institucional.
- No se implementaron mapa interactivo, IA, clasificación, incentivos ni motor de permanencia.
- Navegador probado: Edge/Chromium; no se probaron Safari, Firefox ni dispositivos físicos.
- No se realizaron pruebas de carga ni una auditoría completa de accesibilidad.
- La recuperación por correo ya estaba implementada; no se probó entrega a una bandeja real.
- La aplicación sigue siendo local. Antes de abrirla al público faltan alojamiento, dominio y completar responsable, contacto y plazos de tratamiento de datos.

La verificación inicial de septiembre 7–8 quedó como antecedente. Las reglas y la separación de acceso actuales son las descritas aquí.
