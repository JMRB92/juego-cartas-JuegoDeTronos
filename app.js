/* Juego de Cartas JDT — versión consolidada
   Firebase compat. La entrada a sala NO usa transacciones en el nodo completo.
   Los errores se muestran con operación, código y mensaje reales. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const config = window.FIREBASE_CONFIG;
  const screens = ["pantalla-inicio","pantalla-crear","pantalla-unirse","pantalla-lobby","pantalla-juego"];
  let auth, db, user = null, currentCode = null, roomRef = null, roomCallback = null;
  let room = null, selectedCard = null, busy = false;

  function showScreen(id) {
    screens.forEach(s => { const el=$(s); if(el) el.classList.toggle("hidden",s!==id); });
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function say(text="") { const el=$("mensaje-global"); if(el) el.textContent=text; }
  function setStatus(text, cls="") { const el=$("estado-conexion"); if(el){el.textContent=text;el.className="connection "+cls;} }
  function fail(op, err) {
    console.error(`[${op}]`, err?.code || "", err?.message || err, err);
    say(`${op}: ${err?.code ? err.code+" — " : ""}${err?.message || String(err)}`);
  }
  function randomCode() {
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
  }
  function validateName(name) {
    if(!name) throw new Error("Escribe tu nombre.");
    if(name.length>20) throw new Error("El nombre no puede superar los 20 caracteres.");
  }
  async function ensureUser() {
    if(auth.currentUser) { user=auth.currentUser; return user; }
    const cred=await auth.signInAnonymously();
    user=cred.user; return user;
  }
  function detach() {
    if(roomRef && roomCallback) roomRef.off("value",roomCallback);
    roomRef=null; roomCallback=null;
  }
  function listen(code) {
    detach(); currentCode=code; roomRef=db.ref(`salas/${code}`);
    roomCallback=snap=>{
      if(!snap.exists()){say("La sala ya no existe.");detach();showScreen("pantalla-inicio");return;}
      room=snap.val(); room.codigo=code;
      if(room.estado==="jugando") renderGame(); else renderLobby();
    };
    roomRef.on("value",roomCallback,err=>fail("No se pudo leer la sala",err));
  }
  function playersOf(data=room) { return Object.values(data?.jugadores || {}); }
  function renderLobby() {
    if(!room) return;
    $("codigo-sala").textContent=room.codigo;
    const players=playersOf();
    $("estado-lobby").textContent=`${players.length} de ${room.maxJugadores} jugadores`;
    const list=$("lista-jugadores"); list.replaceChildren();
    players.forEach(p=>{
      const li=document.createElement("li"), name=document.createElement("span");
      name.textContent=p.nombre || "Jugador"; li.appendChild(name);
      if(p.uid===room.creadorUid){const tag=document.createElement("span");tag.className="creador";tag.textContent="ANFITRIÓN";li.appendChild(tag);}
      list.appendChild(li);
    });
    const host=room.creadorUid===user?.uid, canStart=players.length>=2;
    $("btn-iniciar-partida").disabled=!(host && canStart && room.estado==="esperando");
    $("btn-iniciar-partida").textContent=host?"Iniciar partida":"Esperando al anfitrión";
    $("estado-partida").textContent=host?"Puedes iniciar cuando haya al menos 2 jugadores.":"El anfitrión iniciará la partida cuando todos estén listos.";
    showScreen("pantalla-lobby");
  }
  function makeDeck() {
    // 27 cartas del mazo conocido. Las imágenes originales se cargan desde assets/cartas.
    const ids=["01","02","11","12","13","14","15","16","17","18","21","22","23","31","32","33","41","42","43","51","52","61","62","71","72","81","91"];
    return ids.map((id,i)=>({id,value:Number(id[0]),name:cardName(id),image:`assets/cartas/${id}.png`,uid:`${id}-${i}`}));
  }
  function cardName(id) {
    const names={"01":"El Bufón","02":"El Asesino","11":"Carta de valor 1","12":"Carta de valor 1","13":"Carta de valor 1","14":"Carta de valor 1","15":"Carta de valor 1","16":"Carta de valor 1","17":"Carta de valor 1","18":"Carta de valor 1","21":"Carta de valor 2","22":"Carta de valor 2","23":"Carta de valor 2","31":"Carta de valor 3","32":"Carta de valor 3","33":"Carta de valor 3","41":"Carta de valor 4","42":"Carta de valor 4","43":"Carta de valor 4","51":"Carta de valor 5","52":"Carta de valor 5","61":"Carta de valor 6","62":"Carta de valor 6","71":"Carta de valor 7","72":"Carta de valor 7","81":"Carta de valor 8","91":"Carta de valor 9"};
    return names[id] || `Carta ${id}`;
  }
  function cardEffect(id) {
    const effects={
      "01":"Mira la carta de otro jugador. Si gana la ronda, obtienes un punto adicional.",
      "02":"Carta especial de contraataque. Consulta las reglas de la mesa antes de jugarla.",
      "11":"Elige a un jugador y adivina el valor de su carta. Si aciertas, queda eliminado de la ronda.",
      "12":"Elige a un jugador y adivina el valor de su carta. Si aciertas, queda eliminado de la ronda.",
      "13":"Elige a un jugador y adivina el valor de su carta. Si aciertas, queda eliminado de la ronda.",
      "14":"Elige a un jugador y adivina el valor de su carta. Si aciertas, queda eliminado de la ronda.",
      "15":"Elige a un jugador y adivina el valor de su carta. Si aciertas, queda eliminado de la ronda.",
      "16":"Elige a un jugador y adivina el valor de su carta. Si aciertas, queda eliminado de la ronda.",
      "17":"Elige a un jugador y adivina el valor de su carta. Si aciertas, queda eliminado de la ronda.",
      "18":"Regla especial de Jon Nieve: al morir, roba otra carta. Confirma la interpretación con las reglas originales.",
      "21":"Elige a un jugador y mira su carta sin mostrarla a los demás.",
      "22":"Elige a un jugador y mira su carta; puede permitir una segunda observación según las reglas originales.",
      "23":"Elige a un jugador y mira su carta sin mostrarla a los demás.",
      "31":"Compara tu carta con la de otro jugador; la de menor valor queda eliminada.",
      "32":"Compara tu carta con la de otro jugador; la de menor valor queda eliminada.",
      "33":"Elige un jugador y compara las cartas; aplica el resultado indicado en la carta.",
      "41":"Quedas protegido hasta tu siguiente turno.",
      "42":"Quedas protegido hasta tu siguiente turno.",
      "43":"Quedas protegido hasta tu siguiente turno y suma un punto a la comparación final.",
      "51":"Elige a un jugador para que descarte una carta. Efecto especial relacionado con Jaime Lannister.",
      "52":"Elige a un jugador para que descarte una carta. Efecto especial relacionado con Cersei Lannister.",
      "61":"Todos los jugadores intercambian sus cartas al azar.",
      "62":"Intercambia tu carta con la de otro jugador.",
      "71":"Compara tu carta con la de otro jugador; la de menor valor queda eliminada.",
      "72":"Si conservas una carta de valor 5 o 6, debes descartar esta carta. También puedes descartarla voluntariamente.",
      "81":"Si descartas esta carta por un efecto, quedas eliminado.",
      "91":"Elige a un jugador para eliminarlo, salvo que esté protegido por Daenerys; consulta la regla original para el efecto exacto."
    };
    return effects[id] || "Consulta la ilustración original de la carta. Esta descripción es orientativa.";
  }
  function cardImagePath(card) {
    const id=String(card?.id || '').trim();
    return card?.image || (id ? `assets/cartas/${id}.png` : '');
  }
  function makeFallbackCard(card, compact=false) {
    const fallback=document.createElement('div'); fallback.className=compact?'fallback-mini':'fallback-card';
    const value=document.createElement('strong'); value.className='value'; value.textContent=card?.value ?? '?'; fallback.appendChild(value);
    const name=document.createElement(compact?'span':'h3'); name.textContent=card?.name || `Carta ${card?.id || ''}`; fallback.appendChild(name);
    if(!compact){const effect=document.createElement('p');effect.textContent=card?.effect || cardEffect(card?.id);fallback.appendChild(effect);}
    return fallback;
  }
  function makeCardVisual(card, compact=false) {
    const wrap=document.createElement(compact?'div':'button');
    if(!compact){wrap.type='button';wrap.className='playing-card';wrap.addEventListener('dblclick',()=>showCardDetails(card));wrap.title='Pulsa para jugar; doble clic para ampliar la carta';}
    else wrap.className='played-card';
    const path=cardImagePath(card);
    if(path){const img=document.createElement('img');img.src=path;img.alt=card?.name||`Carta ${card?.id||''}`;img.loading='lazy';img.onerror=()=>{img.remove();wrap.insertBefore(makeFallbackCard(card,compact),wrap.firstChild);};wrap.appendChild(img);}
    else wrap.appendChild(makeFallbackCard(card,compact));
    if(compact){const copy=document.createElement('div');copy.className='played-card-copy';const name=document.createElement('strong');name.textContent=card?.name||`Carta ${card?.id||''}`;copy.appendChild(name);const number=document.createElement('small');number.textContent=`Número/valor: ${card?.value ?? '—'}`;copy.appendChild(number);const effect=document.createElement('span');effect.textContent=card?.effect||cardEffect(card?.id);copy.appendChild(effect);wrap.appendChild(copy);}
    else {const info=document.createElement('div');info.className='card-info';const value=document.createElement('span');value.className='value';value.textContent=card?.value ?? '?';info.appendChild(value);const name=document.createElement('span');name.className='card-name';name.textContent=card?.name||`Carta ${card?.id||''}`;info.appendChild(name);wrap.appendChild(info);}
    return wrap;
  }
  function showCardDetails(card) {
    const modal=$('modal-carta'),content=$('contenido-modal-carta');if(!modal||!content)return;
    content.replaceChildren();const path=cardImagePath(card);
    if(path){const img=document.createElement('img');img.className='modal-card-image';img.src=path;img.alt=card?.name||'Carta';img.onerror=()=>{img.remove();content.insertBefore(makeFallbackCard(card,false),content.firstChild);};content.appendChild(img);}
    else content.appendChild(makeFallbackCard(card,false));
    const title=document.createElement('h3');title.textContent=card?.name||`Carta ${card?.id||''}`;content.appendChild(title);
    const number=document.createElement('p');number.textContent=`Número/valor: ${card?.value ?? '—'}`;content.appendChild(number);
    const effect=document.createElement('p');effect.textContent=card?.effect||cardEffect(card?.id);content.appendChild(effect);
    modal.classList.remove('hidden');
  }
  function addHistoryEntry(game, text, kind='') {
    game.historial=game.historial||[];game.historial.push({texto:text,timestamp:Date.now(),tipo:kind});
    if(game.historial.length>300)game.historial=game.historial.slice(-300);
  }
  function renderHistory(game) {
    const targets=[$('historial-partida'),$('historial-completo')].filter(Boolean);
    targets.forEach(list=>{list.replaceChildren();(game.historial||[]).slice().reverse().forEach(entry=>{const li=document.createElement('li');if(entry.tipo)li.classList.add('event-'+entry.tipo);const time=document.createElement('time');time.textContent=new Date(entry.timestamp||Date.now()).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit'});li.appendChild(time);li.appendChild(document.createTextNode(entry.texto||'Acción de la partida'));list.appendChild(li);});});
  }
  function renderGame() {
    if(!room) return;
    showScreen('pantalla-juego');
    const game=room.juego||{};
    $('numero-ronda').textContent=game.ronda||1;
    $('cartas-restantes').textContent=(game.mazo||[]).length;
    $('objetivo-puntos').textContent=room.puntosObjetivo||5;
    const zone=$('zona-jugadores');zone.replaceChildren();
    playersOf().forEach(p=>{
      const tile=document.createElement('div');tile.className='player-tile'+(p.uid===game.turnoUid?' active':'')+((game.protegidos||{})[p.uid]?' protected':'');
      const head=document.createElement('div');head.className='player-head';const n=document.createElement('strong');n.textContent=p.nombre||'Jugador';head.appendChild(n);const badge=document.createElement('span');badge.className='pill';badge.textContent=p.uid===game.turnoUid?'EN TURNO':'EN MESA';head.appendChild(badge);tile.appendChild(head);
      const score=document.createElement('span');score.className='player-score';score.textContent=`Puntuación: ${(game.puntos||{})[p.uid]||0} / ${room.puntosObjetivo||5}`;tile.appendChild(score);
      const stack=document.createElement('div');stack.className='player-played';const title=document.createElement('span');title.className='played-title';title.textContent='Cartas jugadas';stack.appendChild(title);
      const cards=(game.jugadas||[]).filter(x=>x.uid===p.uid);
      if(!cards.length){const empty=document.createElement('small');empty.className='muted';empty.textContent='Todavía no ha jugado cartas.';stack.appendChild(empty);}
      cards.forEach(x=>stack.appendChild(makeCardVisual(x.carta||{},true)));tile.appendChild(stack);zone.appendChild(tile);
    });
    const hand=$('mi-mano');hand.replaceChildren();const mine=(game.manos||{})[user?.uid]||[];
    mine.forEach((card,index)=>{const b=makeCardVisual(card,false);b.disabled=game.turnoUid!==user?.uid||!game.cartaRobada||!!game.cartaJugada;b.classList.toggle('selected',selectedCard===index);b.addEventListener('click',()=>{if(game.turnoUid===user?.uid&&game.cartaRobada&&!game.cartaJugada){selectedCard=index;renderGame();showCardDetails(card);$('contenido-modal-carta')?.querySelector('.card-actions')?.remove();const actions=document.createElement('div');actions.className='card-actions';const play=document.createElement('button');play.className='primary full';play.textContent='Jugar esta carta';play.addEventListener('click',()=>{$('modal-carta').classList.add('hidden');playCard(index);});actions.appendChild(play);const other=document.createElement('button');other.className='secondary full';other.textContent='Ver la otra carta';other.disabled=mine.length<2;other.addEventListener('click',()=>{const next=index===0?1:0;selectedCard=next;renderGame();showCardDetails(mine[next]);const c=$('contenido-modal-carta');c.querySelector('.card-actions')?.remove();const a=document.createElement('div');a.className='card-actions';const pl=document.createElement('button');pl.className='primary full';pl.textContent='Jugar esta carta';pl.addEventListener('click',()=>{$('modal-carta').classList.add('hidden');playCard(next);});a.appendChild(pl);const sw=document.createElement('button');sw.className='secondary full';sw.textContent='Ver la otra carta';sw.addEventListener('click',()=>{selectedCard=index;renderGame();showCardDetails(mine[index]);});a.appendChild(sw);c.appendChild(a);});actions.appendChild(other);$('contenido-modal-carta').appendChild(actions);}else showCardDetails(card);});hand.appendChild(b);});
    const played=$('cartas-jugadas');played.replaceChildren();(game.jugadas||[]).slice().reverse().slice(0,8).forEach(x=>{const item=document.createElement('span');item.className='pill';item.textContent=`${x.nombre}: ${(x.carta||{}).name||'Carta'} (${(x.carta||{}).value??'—'})`;played.appendChild(item);});
    renderHistory(game);
    showSharedEvent(game);
    const myTurn=game.turnoUid===user?.uid;
    $('btn-robar').disabled=!myTurn||!!game.cartaRobada||!!game.cartaJugada;
    $('btn-pasar').disabled=!myTurn||!game.cartaJugada;
    $('mensaje-turno').textContent=myTurn?(game.cartaRobada?'Elige una carta para leer su efecto antes de jugarla.':'Es tu turno. Roba una carta y después elige cuál jugar.'):'Esperando el turno de otro jugador.';
  }
  let lastVisualEvent=null, visualTimer=null;
  function showSharedEvent(game) {
    const ev=game.eventoVisual;if(!ev||ev.id===lastVisualEvent)return;
    lastVisualEvent=ev.id;
    const root=$('evento-visual');if(!root)return;
    root.replaceChildren();root.className='event-overlay';
    const close=document.createElement('button');close.className='event-close';close.textContent='×';close.setAttribute('aria-label','Cerrar aviso');close.onclick=()=>root.classList.add('hidden');root.appendChild(close);
    const title=document.createElement('h2');title.textContent=ev.tipo==='ronda'?'Fin de la ronda':ev.tipo==='comparacion'?'Comparación de cartas':'Carta jugada';root.appendChild(title);
    if(ev.carta)root.appendChild(makeCardVisual(ev.carta,true));
    if(ev.carta2)root.appendChild(makeCardVisual(ev.carta2,true));
    const text=document.createElement('p');text.textContent=ev.texto||'';root.appendChild(text);
    if(ev.puntuaciones){const list=document.createElement('ul');Object.entries(ev.puntuaciones).forEach(([uid,pts])=>{const li=document.createElement('li');li.textContent=`${(room?.jugadores?.[uid]?.nombre)||'Jugador'}: ${pts} puntos`;list.appendChild(li);});root.appendChild(list);}
    root.classList.remove('hidden');root.classList.add('event-pop');
    clearTimeout(visualTimer);visualTimer=setTimeout(()=>root.classList.add('hidden'),2000);
  }
  async function createRoom() {
    if(busy)return; busy=true; say(""); $("btn-generar-partida").disabled=true;
    try {
      const name=$("nombre-creador").value.trim(); validateName(name);
      const max=Number($("numero-jugadores").value), target=Number($("puntos-objetivo").value);
      if(!Number.isInteger(max)||max<2||max>8) throw new Error("Elige entre 2 y 8 jugadores.");
      if(!Number.isInteger(target)||target<1||target>20) throw new Error("El objetivo debe estar entre 1 y 20 puntos.");
      await ensureUser();
      let code=null;
      for(let i=0;i<10&&!code;i++){
        const candidate=randomCode(), ref=db.ref(`salas/${candidate}`);
        const snap=await ref.once("value");
        if(snap.exists()) continue;
        const data={codigo:candidate,creadorUid:user.uid,maxJugadores:max,puntosObjetivo:target,estado:"esperando",creadaEn:firebase.database.ServerValue.TIMESTAMP,jugadores:{[user.uid]:{uid:user.uid,nombre:name,unidoEn:firebase.database.ServerValue.TIMESTAMP}}};
        // El código es aleatorio; set crea el nodo. En colisión extremadamente improbable se comprueba antes.
        await ref.set(data); code=candidate;
      }
      if(!code) throw new Error("No se pudo generar un código único. Vuelve a intentarlo.");
      listen(code); say("");
    } catch(e){fail("Error al crear la sala",e);}
    finally{busy=false;$("btn-generar-partida").disabled=false;}
  }
  async function joinRoom() {
    if(busy)return; busy=true; say(""); $("btn-unirse").disabled=true;
    const name=$("nombre-jugador").value.trim(), code=$("codigo-partida").value.trim().toUpperCase();
    try {
      validateName(name);
      if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Error("El código debe tener 6 caracteres válidos.");
      await ensureUser();
      const ref=db.ref(`salas/${code}`);
      console.info("[UNIRSE] Leyendo sala:",ref.toString());
      const snap=await ref.once("value");
      const data=snap.val();
      console.info("[UNIRSE] Resultado de lectura:",{exists:snap.exists(),estado:data?.estado,jugadores:Object.keys(data?.jugadores||{}).length});
      if(!data) throw new Error("No existe una sala con ese código. Comprueba que el código es correcto.");
      if(data.estado!=="esperando") throw new Error("La partida ya ha comenzado.");
      const existing=data.jugadores||{};
      if(!existing[user.uid] && Object.keys(existing).length>=Number(data.maxJugadores)) throw new Error("La sala está completa.");
      if(!existing[user.uid]) {
        const playerRef=ref.child(`jugadores/${user.uid}`);
        console.info("[UNIRSE] Escribiendo jugador en:",playerRef.toString());
        await playerRef.set({uid:user.uid,nombre,unidoEn:firebase.database.ServerValue.TIMESTAMP});
        console.info("[UNIRSE] Escritura completada.");
      }
      listen(code);
    } catch(e){fail("Error al unirse a la sala",e);}
    finally{busy=false;$("btn-unirse").disabled=false;}
  }
  async function startGame() {
    say("");
    try {
      await ensureUser();
      if(!room || room.creadorUid!==user.uid) throw new Error("Solo el anfitrión puede iniciar la partida.");
      const current=await db.ref(`salas/${currentCode}`).once("value");
      const data=current.val();
      if(!data || data.estado!=="esperando") throw new Error("La sala ya no está esperando jugadores.");
      const players=Object.values(data.jugadores||{});
      if(players.length<2) throw new Error("Se necesitan al menos 2 jugadores.");
      const deck=makeDeck().sort(()=>Math.random()-.5);
      const hands={}; const scores={};
      players.forEach(p=>{hands[p.uid]=[deck.pop()];scores[p.uid]=0;});
      const first=players[Math.floor(Math.random()*players.length)];
      const game={ronda:1,mazo:deck,manos:hands,puntos:scores,turnoUid:first.uid,cartaRobada:false,cartaJugada:false,jugadas:[],historial:[],estado:"jugando"};
      addHistoryEntry(game,`La partida ha comenzado. Empieza ${(data.jugadores[first.uid]||{}).nombre||"el primer jugador"}.`);
      await db.ref(`salas/${currentCode}`).update({estado:"jugando",juego:game});
    } catch(e){fail("No se pudo iniciar la partida",e);}
  }
  async function drawCard() {
    try {
      const snap=await db.ref(`salas/${currentCode}`).once("value"), data=snap.val(), g=data?.juego;
      if(!g||g.turnoUid!==user.uid) throw new Error("No es tu turno.");
      if(g.cartaRobada||g.cartaJugada) throw new Error("Ya has robado una carta en este turno.");
      if(!g.mazo?.length) throw new Error("No quedan cartas en el mazo.");
      const card=g.mazo.pop(); g.manos[user.uid].push(card); g.cartaRobada=true;
      addHistoryEntry(g,`${(data.jugadores[user.uid]||{}).nombre||"Un jugador"} roba una carta.`);
      await db.ref(`salas/${currentCode}/juego`).set(g);
    } catch(e){fail("No se pudo robar carta",e);}
  }
  async function playCard(index) {
    try {
      const snap=await db.ref(`salas/${currentCode}`).once("value"), data=snap.val(), g=data?.juego;
      if(!g||g.turnoUid!==user.uid) throw new Error("No es tu turno.");
      if(!g.cartaRobada) throw new Error("Primero debes robar una carta.");
      if(g.cartaJugada) throw new Error("Ya has jugado una carta en este turno.");
      const hand=g.manos[user.uid]||[];
      if(index<0||index>=hand.length) throw new Error("La carta seleccionada ya no está en tu mano.");
      const card=hand.splice(index,1)[0];
      g.jugadas=g.jugadas||[]; const playerName=(data.jugadores[user.uid]||{}).nombre||"Jugador";
      g.jugadas.push({uid:user.uid,nombre:playerName,carta:card});
      g.cartaJugada=true; g.manos[user.uid]=hand; g.ultimaCartaJugada=card;
      g.eventoVisual={id:Date.now()+Math.random(),tipo:'carta',uid:user.uid,nombre:playerName,carta:card, texto:`${playerName} juega ${card.name||`la carta ${card.id||""}`} (valor ${card.value??"—"}).`};
      addHistoryEntry(g,`${playerName} juega ${card.name||`la carta ${card.id||""}`} (valor ${card.value??"—"}).`,"effect");
      await db.ref(`salas/${currentCode}/juego`).set(g); selectedCard=null;
    } catch(e){fail("No se pudo jugar la carta",e);}
  }
  async function endTurn() {
    try {
      const snap=await db.ref(`salas/${currentCode}`).once("value"), data=snap.val(), g=data?.juego;
      if(!g||g.turnoUid!==user.uid) throw new Error("No es tu turno.");
      if(!g.cartaJugada) throw new Error("Debes robar y jugar una carta antes de terminar el turno.");
      const players=Object.values(data.jugadores||{}), index=players.findIndex(p=>p.uid===user.uid);
      const next=players[(index+1)%players.length];
      addHistoryEntry(g,`${(data.jugadores[user.uid]||{}).nombre||"El jugador"} termina su turno. Ahora juega ${(next||{}).nombre||"el siguiente jugador"}.`);
      g.turnoUid=next.uid; g.cartaRobada=false; g.cartaJugada=false;
      // Cada jugador mantiene una carta en la mano. Las cartas jugadas quedan visibles en la mesa.
      if((g.manos[user.uid]||[]).length>1) g.manos[user.uid]=[g.manos[user.uid][g.manos[user.uid].length-1]];
      if((g.mazo||[]).length===0) {
        const alive=players.filter(p=>(g.manos[p.uid]||[]).length>0);
        let high=-1, winners=[];
        alive.forEach(p=>{const c=(g.manos[p.uid]||[])[0],v=Number(c?.value??0);if(v>high){high=v;winners=[p];}else if(v===high)winners.push(p);});
        if(winners.length===1) {
          const winner=winners[0];g.puntos=g.puntos||{};g.puntos[winner.uid]=(g.puntos[winner.uid]||0)+1;
          addHistoryEntry(g,`${winner.nombre} gana la ronda y suma un punto.`,'round');
          g.eventoVisual={id:Date.now()+Math.random(),tipo:'ronda',nombre:winner.nombre,texto:`${winner.nombre} gana la ronda con una carta de valor ${high}.`,puntuaciones:{...g.puntos}};
          if(g.puntos[winner.uid]>=Number(data.puntosObjetivo||5)) {
            g.estado='finalizada';g.eventoVisual.texto=`¡${winner.nombre} gana la partida! Ha alcanzado ${g.puntos[winner.uid]} puntos.`;
          } else {
            g.ronda=(g.ronda||1)+1;
            const newDeck=makeDeck().sort(()=>Math.random()-.5), newHands={};
            players.forEach(p=>{newHands[p.uid]=[newDeck.pop()];});
            g.mazo=newDeck;g.manos=newHands;g.cartaRobada=false;g.cartaJugada=false;g.jugadas=[];g.protegidos={};g.turnoUid=players[Math.floor(Math.random()*players.length)].uid;
          }
        } else {
          addHistoryEntry(g,'La ronda termina en empate; no se asigna punto.','round');
          g.eventoVisual={id:Date.now()+Math.random(),tipo:'ronda',texto:'La ronda termina en empate. Nadie suma puntos.',puntuaciones:{...(g.puntos||{})}};
          g.ronda=(g.ronda||1)+1;const newDeck=makeDeck().sort(()=>Math.random()-.5),newHands={};players.forEach(p=>newHands[p.uid]=[newDeck.pop()]);
          g.mazo=newDeck;g.manos=newHands;g.cartaRobada=false;g.cartaJugada=false;g.jugadas=[];g.protegidos={};g.turnoUid=players[Math.floor(Math.random()*players.length)].uid;
        }
      }
      await db.ref(`salas/${currentCode}/juego`).set(g);
    } catch(e){fail("No se pudo terminar el turno",e);}
  }
  async function leaveRoom() {
    try {
      if(currentCode && user) {
        const ref=db.ref(`salas/${currentCode}`);
        const snap=await ref.once("value"), data=snap.val();
        if(data?.jugadores?.[user.uid]) await ref.child(`jugadores/${user.uid}`).remove();
        if(data?.creadorUid===user.uid) await ref.update({estado:"cerrada"});
      }
    } catch(e){console.warn("No se pudo limpiar la salida:",e);}
    detach(); currentCode=null; room=null; selectedCard=null; say(""); showScreen("pantalla-inicio");
  }
  function wire() {
    $("cerrar-modal-carta")?.addEventListener("click",()=>$("modal-carta")?.classList.add("hidden"));
    $("modal-carta")?.addEventListener("click",e=>{if(e.target.id==="modal-carta")e.currentTarget.classList.add("hidden");});
    $("btn-historial")?.addEventListener("click",()=>$("modal-historial")?.classList.remove("hidden"));
    $("cerrar-modal-historial")?.addEventListener("click",()=>$("modal-historial")?.classList.add("hidden"));
    $("btn-reglas")?.addEventListener("click",()=>$("modal-reglas")?.classList.remove("hidden"));
    $("btn-como-jugar")?.addEventListener("click",()=>$("modal-como-jugar")?.classList.remove("hidden"));
    $("cerrar-reglas")?.addEventListener("click",()=>$("modal-reglas")?.classList.add("hidden"));
    $("cerrar-como-jugar")?.addEventListener("click",()=>$("modal-como-jugar")?.classList.add("hidden"));
    $("btn-crear-partida").addEventListener("click",()=>{say("");showScreen("pantalla-crear");});
    $("btn-unirse-partida").addEventListener("click",()=>{say("");showScreen("pantalla-unirse");});
    $("btn-volver-inicio-crear").addEventListener("click",()=>showScreen("pantalla-inicio"));
    $("btn-volver-inicio-unirse").addEventListener("click",()=>showScreen("pantalla-inicio"));
    $("numero-jugadores").addEventListener("change",()=>{$("puntos-objetivo").value=Number($("numero-jugadores").value)<=4?5:3;});
    $("btn-generar-partida").addEventListener("click",createRoom);
    $("btn-unirse").addEventListener("click",joinRoom);
    $("codigo-partida").addEventListener("input",e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);});
    $("btn-copiar-codigo").addEventListener("click",async()=>{const code=$("codigo-sala").textContent;try{await navigator.clipboard.writeText(code);say("Código copiado: "+code);}catch(_){window.prompt("Copia el código:",code);}});
    $("btn-salir-sala").addEventListener("click",leaveRoom);
    $("btn-salir-juego").addEventListener("click",leaveRoom);
    $("btn-iniciar-partida").addEventListener("click",startGame);
    $("btn-robar").addEventListener("click",drawCard);
    $("btn-pasar").addEventListener("click",endTurn);
  }
  function boot() {
    try {
      if(!window.firebase || !config) throw new Error("No se han cargado los scripts o la configuración de Firebase.");
      if(!firebase.apps.length) firebase.initializeApp(config);
      auth=firebase.auth(); db=firebase.database();
      auth.onAuthStateChanged(u=>{user=u||null;if(u)setStatus("Firebase conectado","ok");else setStatus("Iniciando sesión…");});
      auth.signInAnonymously().catch(e=>{setStatus("Error de autenticación","bad");fail("No se pudo iniciar sesión anónima",e);});
      wire();
      console.log("Aplicación cargada. Versión consolidada JDT.");
    } catch(e) {setStatus("Error de configuración","bad");fail("No se pudo iniciar la aplicación",e);}
  }
  document.addEventListener("DOMContentLoaded",boot);
})();
