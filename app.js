
"use strict";

// ======================================================
// JUEGO DE CARTAS - JUEGO DE TRONOS
// Fase 1: salas multijugador y lobby con Firebase.
// El juego de cartas todavía no está implementado.
// ======================================================

// 1. CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBLQJx8_PG6GJt-qMJGGZVqI4f1fQpRZzY",
    authDomain: "juego-cartas-jdt.firebaseapp.com",
    databaseURL: "https://juego-cartas-jdt-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "juego-cartas-jdt",
    storageBucket: "juego-cartas-jdt.firebasestorage.app",
    messagingSenderId: "1017793643872",
    appId: "1:1017793643872:web:a84810ffb3c13584510a05",
    measurementId: "G-Y75B2LGBDT"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();
const $ = (id) => document.getElementById(id);

const pantallas = [
    "pantalla-inicio",
    "pantalla-crear",
    "pantalla-unirse",
    "pantalla-lobby",
    "pantalla-juego"
];

let usuario = null;
let partida = null;
let codigoActual = null;
let referenciaSala = null;
let referenciaJugadores = null;
let escuchandoSala = false;

// 2. INICIAR SESIÓN ANÓNIMA
const sesionLista = auth.signInAnonymously()
    .then((credencial) => {
        usuario = credencial.user;
        console.log("Firebase conectado. Sesión anónima iniciada.");
        return usuario;
    })
    .catch((error) => {
        console.error("Error de autenticación:", error.code, error.message);
        alert("No se ha podido conectar con Firebase. Recarga la página e inténtalo de nuevo.");
        throw error;
    });

async function obtenerUsuario() {
    if (usuario) return usuario;
    return await sesionLista;
}

// 3. NAVEGACIÓN
function mostrarPantalla(id) {
    pantallas.forEach((pantallaId) => {
        const elemento = $(pantallaId);
        if (elemento) elemento.classList.add("pantalla-oculta");
    });

    const destino = $(id);
    if (destino) destino.classList.remove("pantalla-oculta");

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function crearCodigo() {
    const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let codigo = "";

    for (let i = 0; i < 6; i++) {
        codigo += caracteres[Math.floor(Math.random() * caracteres.length)];
    }

    return codigo;
}

function actualizarPuntosPorJugadores() {
    const numero = Number($("numero-jugadores").value);
    const puntos = $("puntos-objetivo");
    const explicacion = $("explicacion-puntos");

    if (numero <= 4) {
        puntos.value = "5";
        explicacion.textContent =
            "Objetivo predeterminado: 5 puntos para 2–4 jugadores.";
    } else {
        puntos.value = "3";
        explicacion.textContent =
            "Objetivo predeterminado: 3 puntos para 5–8 jugadores.";
    }
}

// 4. ESCUCHA Y REPRESENTACIÓN DE LA SALA
function dejarDeEscucharSala() {
    if (referenciaSala && escuchadoSala) {
        referenciaSala.off("value");
    }

    if (referenciaJugadores) {
        referenciaJugadores.off();
    }

    referenciaSala = null;
    referenciaJugadores = null;
    escuchandoSala = false;
}

// Variable auxiliar para evitar listeners duplicados.
let escuchadoSala = false;

function escucharSala(codigo) {
    dejarDeEscucharSala();

    codigoActual = codigo;
    referenciaSala = db.ref("salas/" + codigo);
    escuchandoSala = true;
    escuchadoSala = true;

    referenciaSala.on("value", (snapshot) => {
        if (!snapshot.exists()) {
            alert("La sala ya no existe.");
            dejarDeEscucharSala();
            partida = null;
            mostrarPantalla("pantalla-inicio");
            return;
        }

        partida = snapshot.val();
        partida.codigo = codigo;
        renderizarLobby();
    }, (error) => {
        console.error("Error al leer la sala:", error);
        alert("No se ha podido leer la sala. Comprueba las reglas de Firebase.");
    });
}

function renderizarLobby() {
    if (!partida) return;

    $("codigo-sala").textContent = partida.codigo;

    const lista = $("lista-jugadores");
    lista.innerHTML = "";

    const jugadores = Object.values(partida.jugadores || {});

    jugadores.forEach((jugador) => {
        const elemento = document.createElement("li");

        const nombre = document.createElement("span");
        nombre.className = "nombre";
        nombre.textContent = jugador.nombre || "Jugador";

        elemento.appendChild(nombre);

        if (jugador.uid === partida.creadorUid) {
            const etiqueta = document.createElement("span");
            etiqueta.className = "creador";
            etiqueta.textContent = "CREADOR";
            elemento.appendChild(etiqueta);
        }

        lista.appendChild(elemento);
    });

    $("estado-lobby").textContent =
        `Jugadores: ${jugadores.length} de ${partida.maxJugadores}.`;

    // El inicio de la partida se activará en una fase posterior.
    $("btn-iniciar-partida").disabled = true;
    $("btn-iniciar-partida").textContent =
        "Pendiente de implementar el juego";

    mostrarPantalla("pantalla-lobby");
}

// 5. CREAR UNA SALA REAL
async function crearSala() {
    const boton = $("btn-generar-partida");
    const nombre = $("nombre-creador").value.trim();
    const maxJugadores = Number($("numero-jugadores").value);
    const puntosObjetivo = Number($("puntos-objetivo").value);

    if (!nombre) {
        alert("Escribe tu nombre antes de crear la partida.");
        $("nombre-creador").focus();
        return;
    }

    if (nombre.length > 20) {
        alert("El nombre no puede superar los 20 caracteres.");
        return;
    }

    if (!Number.isInteger(maxJugadores) || maxJugadores < 2 || maxJugadores > 8) {
        alert("Selecciona entre 2 y 8 jugadores.");
        return;
    }

    if (!Number.isInteger(puntosObjetivo) || puntosObjetivo < 1 || puntosObjetivo > 20) {
        alert("El objetivo debe ser un número entre 1 y 20.");
        return;
    }

    boton.disabled = true;

    try {
        const jugadorActual = await obtenerUsuario();
        let creada = false;
        let codigo = "";
        let referencia = null;

        // Evitar sobrescribir una sala que ya exista.
        for (let intento = 0; intento < 8 && !creada; intento++) {
            codigo = crearCodigo();
            referencia = db.ref("salas/" + codigo);

            const resultado = await referencia.transaction((datos) => {
                if (datos !== null) return;
                return {
                    codigo,
                    creadorUid: jugadorActual.uid,
                    maxJugadores,
                    puntosObjetivo,
                    estado: "esperando",
                    creadaEn: firebase.database.ServerValue.TIMESTAMP,
                    jugadores: {
                        [jugadorActual.uid]: {
                            uid: jugadorActual.uid,
                            nombre,
                            unidoEn: firebase.database.ServerValue.TIMESTAMP
                        }
                    }
                };
            }, undefined, false);

            creada = resultado.committed;
        }

        if (!creada) {
            throw new Error("No se ha podido generar un código libre. Inténtalo de nuevo.");
        }

        escucharSala(codigo);
    } catch (error) {
        console.error("Error al crear sala:", error);
        alert("No se ha podido crear la partida: " + error.message);
    } finally {
        boton.disabled = false;
    }
}

// 6. UNIRSE A UNA SALA REAL
async function unirseSala() {
    const boton = $("btn-unirse");
    const nombre = $("nombre-jugador").value.trim();
    const codigo = $("codigo-partida").value.trim().toUpperCase();

    if (!nombre) {
        alert("Escribe tu nombre.");
        $("nombre-jugador").focus();
        return;
    }

    if (nombre.length > 20) {
        alert("El nombre no puede superar los 20 caracteres.");
        return;
    }

    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(codigo)) {
        alert("El código debe tener 6 caracteres válidos.");
        $("codigo-partida").focus();
        return;
    }

    boton.disabled = true;

    try {
        const jugadorActual = await obtenerUsuario();
        const referencia = db.ref("salas/" + codigo);

        const resultado = await referencia.transaction((datos) => {
            if (!datos || datos.estado !== "esperando") return;

            if (!datos.jugadores) datos.jugadores = {};

            // Si este usuario ya está en la sala, no lo añade otra vez.
            if (datos.jugadores[jugadorActual.uid]) return datos;

            if (Object.keys(datos.jugadores).length >= datos.maxJugadores) return;

            datos.jugadores[jugadorActual.uid] = {
                uid: jugadorActual.uid,
                nombre,
                unidoEn: firebase.database.ServerValue.TIMESTAMP
            };

            return datos;
        }, undefined, false);

        if (!resultado.committed) {
            const comprobacion = await referencia.once("value");
            const datos = comprobacion.val();

            if (!datos) {
                alert("No existe ninguna partida con ese código.");
            } else if (datos.estado !== "esperando") {
                alert("Esta partida ya ha comenzado.");
            } else if (Object.keys(datos.jugadores || {}).length >= datos.maxJugadores) {
                alert("La partida está completa.");
            } else {
                alert("No se ha podido entrar en la sala. Inténtalo de nuevo.");
            }
            return;
        }

        escucharSala(codigo);
    } catch (error) {
        console.error("Error al unirse a la sala:", error);
        alert("No se ha podido entrar en la partida: " + error.message);
    } finally {
        boton.disabled = false;
    }
}

// 7. COPIAR CÓDIGO DE SALA
$("btn-copiar-codigo").addEventListener("click", async () => {
    const codigo = $("codigo-sala").textContent;

    try {
        await navigator.clipboard.writeText(codigo);
        alert("Código copiado: " + codigo);
    } catch (error) {
        prompt("Copia este código de partida:", codigo);
    }
});

// 8. BOTONES Y FORMULARIOS
$("btn-volver-inicio-crear").addEventListener("click", () => {
    mostrarPantalla("pantalla-inicio");
});

$("btn-volver-inicio-unirse").addEventListener("click", () => {
    mostrarPantalla("pantalla-inicio");
});

$("btn-crear-partida").addEventListener("click", () => {
    actualizarPuntosPorJugadores();
    mostrarPantalla("pantalla-crear");
});

$("btn-unirse-partida").addEventListener("click", () => {
    mostrarPantalla("pantalla-unirse");
});

$("numero-jugadores").addEventListener("change", actualizarPuntosPorJugadores);

$("btn-generar-partida").addEventListener("click", crearSala);
$("btn-unirse").addEventListener("click", unirseSala);

console.log("Interfaz del juego cargada.");
