JUEGO DE CARTAS JDT — PAQUETE CONSOLIDADO

CONTENIDO
- index.html: estructura de pantallas.
- styles.css: diseño adaptable a móvil y ordenador.
- firebase-config.js: configuración Firebase del proyecto actual.
- app.js: creación/entrada a salas, lobby y prototipo básico de turnos.
- firebase-rules.json: reglas iniciales orientativas para pruebas.

INSTALACIÓN
1. Descarga y descomprime este paquete.
2. En tu repositorio GitHub, sube/reemplaza index.html, styles.css, firebase-config.js y app.js en la raíz.
3. No borres la carpeta assets/cartas que ya contiene tus 27 PNG originales. Este paquete no incluye las imágenes originales porque no estaban disponibles para adjuntarlas desde el repositorio en esta sesión.
4. En GitHub, abre Settings > Pages y comprueba que publica desde la rama y carpeta correctas.
5. Espera la publicación y recarga la web con Ctrl+F5.

FIREBASE
- Debe estar activado Authentication > Sign-in method > Anonymous.
- Realtime Database debe ser la misma URL incluida en firebase-config.js.
- Revisa las reglas en Firebase Console. No publiques reglas abiertas a usuarios no autenticados.
- Las reglas del archivo firebase-rules.json son para una prueba inicial y no son una política de seguridad final para partidas públicas.

IMPORTANTE SOBRE EL ESTADO DEL JUEGO
Este paquete consolida el diagnóstico de salas y añade un esqueleto funcional de turnos para comprobar sincronización. No se debe considerar la versión definitiva de las reglas de juego: los efectos especiales exactos de las cartas deben contrastarse con las imágenes originales. El motor de esta versión no implementa todavía todos esos efectos ni una resolución completa de ronda/puntuación. No uses dinero ni datos personales.

DIAGNÓSTICO
En la consola del navegador se registran por separado:
- [UNIRSE] Leyendo sala
- [UNIRSE] Resultado de lectura
- [UNIRSE] Escribiendo jugador en
- [Error al unirse a la sala] con código y mensaje real

Si el error aparece antes de “Resultado de lectura”, falla la lectura/autenticación. Si aparece tras “Escribiendo jugador en”, falla la escritura o sus permisos.
