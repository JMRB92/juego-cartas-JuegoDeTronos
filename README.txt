JUEGO DE CARTAS JDT — PAQUETE INTEGRADO

Contenido:
- index.html, styles.css, app.js, firebase-config.js
- assets/cartas/: las 27 ilustraciones originales
- firebase-rules.json: reglas actuales de referencia

INSTALACIÓN EN GITHUB PAGES
1. Haz una copia de seguridad del repositorio actual.
2. Descomprime este paquete.
3. Sube/reemplaza index.html, styles.css y app.js en la raíz del repositorio.
4. Sube la carpeta assets/cartas completa conservando los nombres 01.png, 02.png, etc.
5. Conserva firebase-config.js si contiene tu configuración Firebase funcional.
6. No sustituyas las reglas de Firebase a ciegas. Las reglas de prototipo permiten a cualquier usuario autenticado modificar salas; no son apropiadas para un lanzamiento público.
7. Haz commit y espera a que GitHub Pages publique los cambios. Prueba primero con dos navegadores/dispositivos.

REGLAS IMPLEMENTADAS
- Salas multijugador Firebase, robo y juego de carta, turnos, objetivos de puntos, registro de eventos, eliminación de ronda, comparaciones y pantalla final.
- Efectos interpretados desde las ilustraciones originales: adivinación de valor, mirar cartas, comparación mayor/menor, protección, intercambio de manos, descarte forzado, ataque de Drogon y puntos adicionales de Theon.
- La carta de reserva textual aparece si falla una imagen.

LIMITACIONES IMPORTANTES
Las ilustraciones contienen reglas adaptadas y algunas frases/efectos no son inequívocos en el material disponible. La implementación de esas cartas se ha interpretado a partir de su texto visible; no se debe considerar una transcripción oficial de reglas. Antes de una partida competitiva, revisa especialmente los efectos especiales de Arya, Jon Snow, Cersei/Jaime, el Rey de la Noche, Sansa, Daenerys y Drogon.

Los efectos que requieren elegir jugador/valor usan cuadros de diálogo del navegador. Son funcionales como primera versión, pero no tan pulidos como un selector gráfico dentro del tablero.

SEGURIDAD
La configuración web Firebase no es una contraseña. Sin embargo, las reglas de Realtime Database deben restringir quién puede leer/escribir cada sala y qué acciones puede realizar cada jugador. El cliente no es una autoridad segura contra trampas; para uso público se recomienda validar movimientos en un backend confiable.
