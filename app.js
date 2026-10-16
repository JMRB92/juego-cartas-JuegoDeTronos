
/* FIREBASE: conexión inicial */
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

firebase.initializeApp(firebaseConfig);

const firebaseAuth = firebase.auth();
const firebaseDatabase = firebase.database();

// Iniciar sesión sin pedir cuenta ni correo electrónico.
firebaseAuth.signInAnonymously()
  .then(() => {
    console.log("Firebase conectado. Sesión anónima iniciada.");
  })
  .catch((error) => {
    console.error("Error al iniciar sesión en Firebase:", error.code, error.message);
  });

/* FIN DE LA CONEXIÓN INICIAL */

"use strict";

// ======================================================
// JUEGO DE CARTAS - JUEGO DE TRONOS
// Primera versión: navegación y lobby local de prueba.
// Todavía no es multijugador.
// ======================================================

const $ = (id) => document.getElementById(id);

const pantallas = [
    "pantalla-inicio",
    "pantalla-crear",
    "pantalla-unirse",
    "pantalla-lobby",
    "pantalla-juego"
];

let partida = null;
let soyCreador = false;

function mostrarPantalla(id) {
    pantallas.forEach((pantallaId) => {
        $(pantallaId).classList.add("pantalla-oculta");
    });

    $(id).classList.remove("pantalla-oculta");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function crearCodigo() {
    const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let codigo = "";

    for (let i = 0; i < 6; i++) {
        codigo += caracteres[
            Math.floor(Math.random() * caracteres.length)
        ];
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

function renderizarLobby() {
    $("codigo-sala").textContent = partida.codigo;

    const lista = $("lista-jugadores");
    lista.innerHTML = "";

    partida.jugadores.forEach((jugador) => {
        const elemento = document.createElement("li");

        const nombre = document.createElement("span");
        nombre.className = "nombre";
        nombre.textContent = jugador.nombre;

        elemento.appendChild(nombre);

        if (jugador.esCreador) {
            const etiqueta = document.createElement("span");
            etiqueta.className = "creador";
            etiqueta.textContent = "CREADOR";
            elemento.appendChild(etiqueta);
        }

        lista.appendChild(elemento);
    });

    $("estado-lobby").textContent =
        `Jugadores: ${partida.jugadores.length} de ${partida.maxJugadores}.`;

    // En esta versión local no se permite iniciar una partida
    // hasta que esté conectado el multijugador real.
    $("btn-iniciar-partida").disabled = true;
    $("btn-iniciar-partida").textContent =
        "Pendiente de activar el juego";

    $("btn-generar-partida").disabled = false;

    mostrarPantalla("pantalla-lobby");
}

// Volver a la pantalla inicial.
$("btn-volver-inicio-crear").addEventListener("click", () => {
    mostrarPantalla("pantalla-inicio");
});

$("btn-volver-inicio-unirse").addEventListener("click", () => {
    mostrarPantalla("pantalla-inicio");
});

// Abrir los formularios.
$("btn-crear-partida").addEventListener("click", () => {
    actualizarPuntosPorJugadores();
    mostrarPantalla("pantalla-crear");
});

$("btn-unirse-partida").addEventListener("click", () => {
    mostrarPantalla("pantalla-unirse");
});

// Actualizar automáticamente los puntos predeterminados.
$("numero-jugadores").addEventListener(
    "change",
    actualizarPuntosPorJugadores
);

// Crear una sala de prueba local.
$("btn-generar-partida").addEventListener("click", () => {
    const nombre = $("nombre-creador").value.trim();
    const maxJugadores = Number($("numero-jugadores").value);
    const puntosObjetivo = Number($("puntos-objetivo").value);

    if (!nombre) {
        alert("Escribe tu nombre antes de crear la partida.");
        $("nombre-creador").focus();
        return;
    }

    if (
        !Number.isInteger(puntosObjetivo) ||
        puntosObjetivo < 1 ||
        puntosObjetivo > 20
    ) {
        alert("El objetivo debe ser un número entre 1 y 20.");
        $("puntos-objetivo").focus();
        return;
    }

    soyCreador = true;

    partida = {
        codigo: crearCodigo(),
        maxJugadores,
        puntosObjetivo,
        jugadores: [
            {
                nombre,
                esCreador: true
            }
        ]
    };

    renderizarLobby();
});

// Copiar el código de la sala.
$("btn-copiar-codigo").addEventListener("click", async () => {
    const codigo = $("codigo-sala").textContent;

    try {
        await navigator.clipboard.writeText(codigo);
        alert("Código copiado: " + codigo);
    } catch (error) {
        // Alternativa si el navegador no permite copiar.
        prompt("Copia este código de partida:", codigo);
    }
});

// Intentar unirse a una sala.
$("btn-unirse").addEventListener("click", () => {
    const nombre = $("nombre-jugador").value.trim();
    const codigo = $("codigo-partida").value.trim().toUpperCase();

    if (!nombre) {
        alert("Escribe tu nombre.");
        $("nombre-jugador").focus();
        return;
    }

    if (!/^[A-Z0-9]{6}$/.test(codigo)) {
        alert("El código debe tener 6 letras o números.");
        $("codigo-partida").focus();
        return;
    }

    alert(
        "La interfaz está preparada, pero el multijugador todavía " +
        "no está conectado.\n\n" +
        "En el siguiente paso añadiremos Firebase para que puedas " +
        "crear y compartir partidas reales."
    );
});

console.log("Interfaz del juego cargada correctamente.");
