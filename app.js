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
  let catalogDetailReturn = false;

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
    return ids.map((id,i)=>({id,value:Number(id[0]),name:cardName(id),characteristic:CARD_META[id]?.[1]||"Carta",character:CARD_META[id]?.[2]||"",effect:cardEffect(id),image:`assets/cartas/${id}.png`,uid:`${id}-${i}`}));
  }
  const CARD_META = {
    "01": [0,"Bufón","Theon Greyjoy"], "02":[0,"Asesino","Arya Stark"],
    "11":[1,"Guerrero","Euron Greyjoy"], "12":[1,"Guerrero","Ramsay Bolton"],
    "13":[1,"Guerrero","Khal Drogo"], "14":[1,"Guerrero","Tormund"],
    "15":[1,"Guerrero","El Perro"], "16":[1,"Guerrero","Bronn"],
    "17":[1,"Guerrero","Brienne de Tarth"], "18":[1,"Guerrero","Jon Snow"],
    "21":[2,"Curioso","Missandei"], "22":[2,"Curioso","Brandon Stark"], "23":[2,"Curioso","Samwell Tarly"],
    "31":[3,"Estratega","Meñique"], "32":[3,"Estratega","Varys"], "33":[3,"Estratega","Tyrion Lannister"],
    "41":[4,"Aliado","Jorah Mormont"], "42":[4,"Aliado","Lyanna Mormont"], "43":[4,"Aliado","Gusano Gris"],
    "51":[5,"Gemelo","Cersei Lannister"], "52":[5,"Gemelo","Jaime Lannister"],
    "61":[6,"Rey","Rey de la Noche"], "62":[6,"Rey","Joffrey Baratheon"],
    "71":[7,"Lady","Olenna Tyrell"], "72":[7,"Lady","Sansa Stark"],
    "81":[8,"Khaleesi","Daenerys Targaryen"], "91":[9,"Dragón","Drogon"]
  };
  function cardName(id) { const m=CARD_META[String(id)]; return m ? `${m[1]} · ${m[2]}` : `Carta ${id}`; }
  function cardEffect(id) {
    const effects={
      "01":"Elige a un jugador. Si gana la ronda, tú sumas un punto adicional. Aparece una gota azul junto a su nombre durante la ronda.",
      "02":"Si un efecto te fuera a eliminar mientras conservas esta carta, descártala, roba otra carta y no mueres.",
      "11":"Elige un jugador y adivina el valor de su carta. Si aciertas, queda eliminado.","12":"Elige un jugador y adivina el valor de su carta. Si aciertas, queda eliminado.","13":"Elige un jugador y adivina el valor de su carta. Si aciertas, queda eliminado.","14":"Elige un jugador y adivina el valor de su carta. Si aciertas, queda eliminado.","15":"Elige un jugador y adivina el valor de su carta. Si aciertas, queda eliminado.","16":"Elige un jugador y adivina el valor de su carta. Si aciertas, queda eliminado.","17":"Elige un jugador y adivina el valor de su carta. Si aciertas, queda eliminado.",
      "18":"Si un efecto te fuera a eliminar, descarta Jon Snow, roba otra carta y no mueres.",
      "21":"Elige un jugador y mira su carta en secreto.","22":"Elige hasta dos jugadores y mira sus cartas. Con dos jugadores en la partida solo puedes mirar la del otro jugador.","23":"Elige un jugador y mira su carta en secreto.",
      "31":"Compara tu carta con la de otro jugador. La de menor valor queda eliminada.","32":"Compara tu carta con la de otro jugador. La de menor valor queda eliminada.","33":"Elige si debe morir la carta mayor o la menor y luego elige un jugador para comparar. Si te atacan con un 3 o un 7 mientras conservas esta carta, puedes redirigir el ataque a otro jugador.",
      "41":"Quedas protegido hasta que vuelva a comenzar tu siguiente turno. No puedes ser elegido como objetivo.","42":"Quedas protegido hasta que vuelva a comenzar tu siguiente turno. No puedes ser elegido como objetivo. Al final de ronda sumas +1 al valor de tu carta.","43":"Quedas protegido hasta que vuelva a comenzar tu siguiente turno. No puedes ser elegido como objetivo.",
      "51":"Elige un jugador. Si tiene el otro 5, ganas la ronda. Si no, descarta su carta: si era un 8, queda eliminado; si era cualquier otra carta, roba una carta de reemplazo.","52":"Elige un jugador. Si tiene el otro 5, ganas la ronda. Si no, descarta su carta: si era un 8, queda eliminado; si era cualquier otra carta, roba una carta de reemplazo.",
      "61":"Reúne las cartas que conservan todos los jugadores vivos y repártelas de nuevo al azar entre ellos.","62":"Elige a otro jugador e intercambia tu carta con la suya.",
      "71":"Compara tu carta con la de otro jugador. La de mayor valor queda eliminada.","72":"Si conservas un 5 o un 6, debes descartar esta carta. También puedes descartarla voluntariamente.","81":"Si descartas esta carta por el efecto de otra carta o voluntariamente, quedas eliminado de la ronda.","91":"Elige a un jugador no protegido. Si tiene un 8, no ocurre nada. Si tiene a Jon Snow, descarta esa carta y roba otra; en otro caso queda eliminado."
    }; return effects[String(id)] || "Consulta las reglas de esta carta.";
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
  function allCards() {
    return Object.keys(CARD_META).map(id=>({id,value:Number(id[0]),name:cardName(id),characteristic:CARD_META[id][1],character:CARD_META[id][2],effect:cardEffect(id),image:`assets/cartas/${id}.png`}));
  }
  let catalogIndex=0;
  function showCatalogCard(index) {
    const cards=allCards();catalogIndex=(index+cards.length)%cards.length;
    const card=cards[catalogIndex],modal=$('modal-carta'),content=$('contenido-modal-carta');if(!modal||!content)return;
    catalogDetailReturn = catalogDetailReturn || !$('modal-reglas')?.classList.contains('hidden');
    $('modal-reglas')?.classList.add('hidden');
    content.replaceChildren();
    const image=document.createElement('img');image.className='modal-card-image';image.src=card.image;image.alt=card.name;image.onerror=()=>image.remove();content.appendChild(image);
    const title=document.createElement('h2');title.textContent=`${card.value} · ${card.characteristic} · ${card.character}`;content.appendChild(title);
    const effect=document.createElement('p');effect.textContent=card.effect;content.appendChild(effect);
    const nav=document.createElement('div');nav.className='button-row';
    const prev=document.createElement('button');prev.className='secondary';prev.textContent='← Carta anterior';prev.onclick=()=>showCatalogCard(catalogIndex-1);
    const next=document.createElement('button');next.className='secondary';next.textContent='Carta siguiente →';next.onclick=()=>showCatalogCard(catalogIndex+1);
    const close=document.createElement('button');close.className='primary';close.textContent='Cerrar';close.onclick=()=>{modal.classList.add('hidden');if(catalogDetailReturn){$('modal-reglas')?.classList.remove('hidden');catalogDetailReturn=false;}};
    nav.append(prev,next,close);content.appendChild(nav);modal.classList.remove('hidden');
  }
  function renderCatalog() {
    const root=$('catalogo-cartas');if(!root)return;root.replaceChildren();
    allCards().forEach((card,index)=>{
      const b=document.createElement('button');b.type='button';b.className='catalog-card';
      const img=document.createElement('img');img.src=card.image;img.alt=card.name;img.onerror=()=>img.remove();b.appendChild(img);
      const title=document.createElement('strong');title.textContent=`${card.value} · ${card.character}`;b.appendChild(title);
      const sub=document.createElement('span');sub.textContent=card.characteristic;b.appendChild(sub);
      b.onclick=()=>showCatalogCard(index);root.appendChild(b);
    });
  }
  function addHistoryEntry(game, text, kind='') {
    if (!game || typeof game !== "object") throw new Error("El estado de la partida no es válido.");
    if (!Array.isArray(game.historial)) game.historial = [];
    game.historial.push({texto:text,timestamp:Date.now(),tipo:kind});
    if(game.historial.length>300)game.historial=game.historial.slice(-300);
  }

  // Normaliza los arrays del estado compartido. Algunas salas creadas con versiones
  // anteriores pueden no contener todavía todos los campos del motor actual.
  function normalizeGameForAction(game, uid) {
    if (!game || typeof game !== "object") throw new Error("No se ha encontrado el estado de la partida.");
    if (!game.manos || typeof game.manos !== "object") game.manos = {};
    if (!Array.isArray(game.manos[uid])) game.manos[uid] = [];
    if (!Array.isArray(game.jugadas)) game.jugadas = [];
    if (!Array.isArray(game.historial)) game.historial = [];
    if (!Array.isArray(game.mazo)) game.mazo = [];
    if (!game.puntos || typeof game.puntos !== "object") game.puntos = {};
    if (!game.protegidos || typeof game.protegidos !== "object") game.protegidos = {};
    if (!game.eliminados || typeof game.eliminados !== "object") game.eliminados = {};
    return game;
  }
  function renderHistory(game) {
    const targets=[$('historial-partida'),$('historial-completo')].filter(Boolean);
    targets.forEach(list=>{list.replaceChildren();(game.historial||[]).slice().reverse().forEach(entry=>{const li=document.createElement('li');if(entry.tipo)li.classList.add('event-'+entry.tipo);const time=document.createElement('time');time.textContent=new Date(entry.timestamp||Date.now()).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit'});li.appendChild(time);li.appendChild(document.createTextNode(entry.texto||'Acción de la partida'));list.appendChild(li);});});
  }
  let timerInterval=null, timeoutInProgress=false;
  async function handleTimeout() {
    if(timeoutInProgress||!room||!user)return;timeoutInProgress=true;
    try{
      const snap=await db.ref(`salas/${currentCode}`).once('value'),data=snap.val(),g=data?.juego;
      if(!g||g.estado==='finalizada'||g.turnoUid!==user.uid||!g.temporizadorActivo||g.partidaPausada)return;
      const elapsed=Date.now()-Number(g.turnoStartedAt||Date.now()),remaining=Number(g.tiempoRestanteMs??120000)-elapsed;
      if(remaining>0)return;
      g.manos[user.uid]=[];g.cartaJugada=true;g.cartaRobada=true;
      addHistoryEntry(g,`${data.jugadores?.[user.uid]?.nombre||'El jugador'} agotó los 2 minutos y queda eliminado de la ronda.`,'effect');
      g.eventoVisual={id:Date.now()+Math.random(),tipo:'ataque',texto:`${data.jugadores?.[user.uid]?.nombre||'El jugador'} agotó el tiempo y queda eliminado de la ronda.`};
      await db.ref(`salas/${currentCode}/juego`).set(g);await endTurn();
    }catch(e){console.warn('No se pudo aplicar el límite de tiempo',e);}
    finally{timeoutInProgress=false;}
  }
  function updateTimerUI(game) {
    const label=$('temporizador-turno'),pause=$('btn-pausar');if(!label||!pause)return;
    const active=!!game.temporizadorActivo&&game.estado!=='finalizada';
    label.classList.toggle('hidden',!active);pause.classList.toggle('hidden',!active);
    pause.textContent=game.partidaPausada?'Reanudar partida':'Pausar partida';
    if(!active){label.textContent='';return;}
    if(game.partidaPausada){label.textContent=`PARTIDA PAUSADA · Quedaban ${formatClock(Number(game.tiempoRestanteMs||120000))}`;return;}
    const elapsed=Date.now()-Number(game.turnoStartedAt||Date.now()),left=Math.max(0,Number(game.tiempoRestanteMs??120000)-elapsed);
    label.textContent=`Tiempo restante: ${formatClock(left)}`;
    if(left<=0&&game.turnoUid===user?.uid)handleTimeout();
  }
  function formatClock(ms){const total=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;}
  async function togglePause() {
    try{
      const snap=await db.ref(`salas/${currentCode}`).once('value'),data=snap.val(),g=data?.juego;
      if(!g||!g.temporizadorActivo||g.estado==='finalizada')return;
      if(!g.partidaPausada){const elapsed=Date.now()-Number(g.turnoStartedAt||Date.now());g.tiempoRestanteMs=Math.max(0,Number(g.tiempoRestanteMs??120000)-elapsed);g.partidaPausada=true;}
      else {g.partidaPausada=false;g.turnoStartedAt=Date.now();}
      addHistoryEntry(g,g.partidaPausada?'La partida se ha pausado.':'La partida se ha reanudado.');
      await db.ref(`salas/${currentCode}/juego`).set(g);
    }catch(e){fail('No se pudo pausar/reanudar la partida',e);}
  }
  function renderFinalRanking(game) {
    const modal=$('pantalla-final');if(!modal||game.estado!=='finalizada')return;
    const ranking=Object.values(room.jugadores||{}).map(p=>({name:p.nombre||'Jugador',points:Number(game.puntos?.[p.uid]||0),uid:p.uid})).sort((a,b)=>b.points-a.points);
    const max=ranking[0]?.points||0, winners=ranking.filter(p=>p.points===max);
    $('texto-ganador').textContent=winners.length===1?`Ganador: ${winners[0].name} · ${winners[0].points} puntos`:`Empate en cabeza: ${winners.map(p=>p.name).join(', ')} · ${max} puntos`;
    const list=$('ranking-final');list.replaceChildren();ranking.forEach((p,i)=>{const li=document.createElement('li');li.textContent=`${i+1}. ${p.name} — ${p.points} puntos`;if(p.points===max)li.classList.add('rank-winner');list.appendChild(li);});
    modal.classList.remove('hidden');
  }
  function renderGame() {
    if(!room) return;
    showScreen('pantalla-juego');
    const game=room.juego||{};
    updateTimerUI(game);renderFinalRanking(game);
    $('numero-ronda').textContent=game.ronda||1;
    $('cartas-restantes').textContent=(game.mazo||[]).length;
    $('objetivo-puntos').textContent=room.puntosObjetivo||5;
    const zone=$('zona-jugadores');zone.replaceChildren();
    playersOf().forEach(p=>{
      const tile=document.createElement('div');tile.className='player-tile'+(p.uid===game.turnoUid?' active':'')+((game.protegidos||{})[p.uid]?' protected':'');
      const head=document.createElement('div');head.className='player-head';const nameWrap=document.createElement('div');nameWrap.className='player-name-wrap';const n=document.createElement('strong');n.textContent=p.nombre||'Jugador';const dead=(game.manos?.[p.uid]||[]).length===0;if(dead){n.classList.add('player-dead-name');n.title='Eliminado durante esta ronda';}nameWrap.appendChild(n);if((game.protegidos||{})[p.uid]){const prot=document.createElement('span');prot.className='protection-label';prot.textContent='PROTEGIDO';nameWrap.appendChild(prot);}if((game.apuestasTheon||{})[p.uid]){const drop=document.createElement('span');drop.className='teardrop';drop.textContent='💧';drop.title='Si este jugador gana la ronda, el jugador que jugó la carta 0 obtiene un punto adicional.';nameWrap.appendChild(drop);}head.appendChild(nameWrap);const badge=document.createElement('span');badge.className='pill';badge.textContent=p.uid===game.turnoUid?'EN TURNO':'EN MESA';head.appendChild(badge);tile.appendChild(head);
      const score=document.createElement('span');score.className='player-score';score.textContent=`Puntuación: ${(game.puntos||{})[p.uid]||0} / ${room.puntosObjetivo||5}`;tile.appendChild(score);
      const stack=document.createElement('div');stack.className='player-played';const title=document.createElement('span');title.className='played-title';title.textContent='Cartas jugadas';stack.appendChild(title);
      const cards=(game.jugadas||[]).filter(x=>x.uid===p.uid);
      if(!cards.length){const empty=document.createElement('small');empty.className='muted';empty.textContent='Todavía no ha jugado cartas.';stack.appendChild(empty);}
      cards.forEach(x=>{const visual=makeCardVisual(x.carta||{},true);visual.classList.add('played-card-clickable');visual.tabIndex=0;visual.setAttribute('role','button');visual.title='Ver qué ocurrió al jugar esta carta';visual.addEventListener('click',()=>showPlayedDetails(x));visual.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showPlayedDetails(x);}});if(x.cartaVista && x.uid!==user?.uid){/* no revelar la carta vista a otros jugadores */}stack.appendChild(visual);});tile.appendChild(stack);zone.appendChild(tile);
    });
    const hand=$('mi-mano');hand.replaceChildren();const mine=(game.manos||{})[user?.uid]||[];
    mine.forEach((card,index)=>{const b=makeCardVisual(card,false);b.disabled=game.turnoUid!==user?.uid||!game.cartaRobada||!!game.cartaJugada;b.classList.toggle('selected',selectedCard===index);b.addEventListener('click',()=>{if(game.turnoUid===user?.uid&&game.cartaRobada&&!game.cartaJugada){selectedCard=index;renderGame();showCardDetails(card);$('contenido-modal-carta')?.querySelector('.card-actions')?.remove();const actions=document.createElement('div');actions.className='card-actions';const play=document.createElement('button');play.className='primary full';play.textContent='Jugar esta carta';play.addEventListener('click',()=>{$('modal-carta').classList.add('hidden');playCard(index);});actions.appendChild(play);const other=document.createElement('button');other.className='secondary full';other.textContent='Ver la otra carta';other.disabled=mine.length<2;other.addEventListener('click',()=>{const next=index===0?1:0;selectedCard=next;renderGame();showCardDetails(mine[next]);const c=$('contenido-modal-carta');c.querySelector('.card-actions')?.remove();const a=document.createElement('div');a.className='card-actions';const pl=document.createElement('button');pl.className='primary full';pl.textContent='Jugar esta carta';pl.addEventListener('click',()=>{$('modal-carta').classList.add('hidden');playCard(next);});a.appendChild(pl);const sw=document.createElement('button');sw.className='secondary full';sw.textContent='Ver la otra carta';sw.addEventListener('click',()=>{selectedCard=index;renderGame();showCardDetails(mine[index]);});a.appendChild(sw);c.appendChild(a);});actions.appendChild(other);$('contenido-modal-carta').appendChild(actions);}else showCardDetails(card);});hand.appendChild(b);});
    const played=$('cartas-jugadas');played.replaceChildren();(game.jugadas||[]).slice().reverse().slice(0,8).forEach(x=>{const item=document.createElement('span');item.className='pill';item.textContent=`${x.nombre}: ${(x.carta||{}).name||'Carta'} (${(x.carta||{}).value??'—'})`;played.appendChild(item);});
    renderHistory(game);
    showSharedEvent(game);
    const myTurn=game.turnoUid===user?.uid&&!game.partidaPausada;
    $('btn-robar').disabled=!myTurn||!!game.cartaRobada||!!game.cartaJugada;
    $('btn-pasar').disabled=!myTurn||!game.cartaJugada;
    $('mensaje-turno').textContent=game.estado==='finalizada'?(game.eventoVisual?.texto||'La partida ha terminado.'):(myTurn?(game.cartaRobada?'Elige una carta para leer su efecto antes de jugarla.':'Es tu turno. Roba una carta y después elige cuál jugar.'):'Esperando el turno de otro jugador.');
    if(game.estado==='finalizada'){ $('btn-robar').disabled=true; $('btn-pasar').disabled=true; } if(game.partidaPausada){$('btn-robar').disabled=true;$('btn-pasar').disabled=true;$('mensaje-turno').textContent='Partida pausada por un jugador.';}
  }
  let lastVisualEvent=null, visualTimer=null;
  function showSharedEvent(game) {
    const ev=game.eventoVisual;if(!ev||ev.id===lastVisualEvent)return;
    lastVisualEvent=ev.id;
    const root=$('evento-visual');if(!root)return;
    root.replaceChildren();root.className='event-overlay';
    const close=document.createElement('button');close.className='event-close';close.textContent='×';close.setAttribute('aria-label','Cerrar aviso');close.onclick=()=>root.classList.add('hidden');root.appendChild(close);
    const title=document.createElement('h2');title.textContent=ev.tipo==='ronda'?'Fin de la ronda':ev.tipo==='comparacion'?'Resolución de comparación':ev.tipo==='ataque'?'Resolución del ataque':'Resolución de la carta';root.appendChild(title);
    if(ev.jugadorNombre){const actor=document.createElement('p');actor.className='event-actor';actor.textContent=`Jugador que actuó: ${ev.jugadorNombre}`;root.appendChild(actor);}
    if(ev.carta){const label=document.createElement('h3');label.textContent='Carta jugada';root.appendChild(label);root.appendChild(makeCardVisual(ev.carta,true));}
    if(ev.objetivoNombre){const target=document.createElement('p');target.textContent=`Objetivo: ${ev.objetivoNombre}`;root.appendChild(target);}
    if(ev.carta2){const label=document.createElement('h3');label.textContent=ev.tipo==='comparacion'?'Cartas comparadas':'Segunda carta implicada';root.appendChild(label);root.appendChild(makeCardVisual(ev.carta2,true));}
    if(ev.cartaDescartada){const label=document.createElement('h3');label.textContent='Carta descartada por el efecto';root.appendChild(label);root.appendChild(makeCardVisual(ev.cartaDescartada,true));}
    if(ev.numeroElegido!==undefined){const guess=document.createElement('p');guess.textContent=`Valor adivinado: ${ev.numeroElegido} · ${ev.acierto?'Acierto':'Fallo'}`;root.appendChild(guess);}
    const text=document.createElement('p');text.className='event-resolution';text.textContent=ev.texto||'La carta se ha jugado.';root.appendChild(text);
    if(ev.puntuaciones){const label=document.createElement('h3');label.textContent='Puntuación actual';root.appendChild(label);const list=document.createElement('ul');Object.entries(ev.puntuaciones).forEach(([uid,pts])=>{const li=document.createElement('li');li.textContent=`${(room?.jugadores?.[uid]?.nombre)||'Jugador'}: ${pts} puntos`;list.appendChild(li);});root.appendChild(list);}
    const done=document.createElement('button');done.className='primary full';done.textContent='Cerrar';done.onclick=()=>root.classList.add('hidden');root.appendChild(done);
    root.classList.remove('hidden');root.classList.add('event-pop');
    clearTimeout(visualTimer);
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
        const data={codigo:candidate,creadorUid:user.uid,maxJugadores:max,puntosObjetivo:target,temporizadorActivo:$("temporizador-activo")?.value==="si",estado:"esperando",creadaEn:firebase.database.ServerValue.TIMESTAMP,jugadores:{[user.uid]:{uid:user.uid,nombre:name,unidoEn:firebase.database.ServerValue.TIMESTAMP}}};
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
        await playerRef.set({uid:user.uid,nombre:name,unidoEn:firebase.database.ServerValue.TIMESTAMP});
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
      const game={ronda:1,mazo:deck,manos:hands,puntos:scores,turnoUid:first.uid,cartaRobada:false,cartaJugada:false,jugadas:[],historial:[],eliminados:{},temporizadorActivo:!!data.temporizadorActivo,tiempoRestanteMs:120000,turnoStartedAt:Date.now(),partidaPausada:false,estado:"jugando"};
      addHistoryEntry(game,`La partida ha comenzado. Empieza ${(data.jugadores[first.uid]||{}).nombre||"el primer jugador"}.`);
      await db.ref(`salas/${currentCode}`).update({estado:"jugando",juego:game});
    } catch(e){fail("No se pudo iniciar la partida",e);}
  }
  async function drawCard() {
    try {
      const snap=await db.ref(`salas/${currentCode}`).once("value"), data=snap.val(), g=data?.juego;
      if(!g||g.turnoUid!==user.uid) throw new Error("No es tu turno."); if(g.partidaPausada)throw new Error("La partida está pausada.");
      normalizeGameForAction(g,user.uid);
      if(g.cartaRobada||g.cartaJugada) throw new Error("Ya has robado una carta en este turno.");
      if(!g.mazo.length) throw new Error("No quedan cartas en el mazo.");
      // Una mano vacía significa que el jugador está eliminado de la ronda.
      // No se le debe repartir una carta automáticamente, porque eso lo resucitaría.
      if(g.manos[user.uid].length===0) throw new Error("Estás eliminado de esta ronda y no puedes robar cartas.");
      const card=g.mazo.pop();
      if(!card) throw new Error("No se ha podido robar una carta del mazo.");
      g.manos[user.uid].push(card); g.cartaRobada=true;
      addHistoryEntry(g,`${(data.jugadores[user.uid]||{}).nombre||"Un jugador"} roba una carta.`);
      await db.ref(`salas/${currentCode}/juego`).set(g);
    } catch(e){fail("No se pudo robar carta",e);}
  }
  function eligibleTargets(g, data, actorUid) {
    return Object.values(data.jugadores||{}).filter(p=>p.uid!==actorUid && (g.manos?.[p.uid]||[]).length>0 && !(g.protegidos||{})[p.uid]);
  }
  function chooseFromDropdown(title, options, placeholder='Selecciona una opción') {
    return new Promise(resolve=>{
      const modal=$('modal-carta'), content=$('contenido-modal-carta');
      if(!modal||!content){resolve(null);return;}
      content.replaceChildren();
      const h=document.createElement('h2');h.textContent=title;content.appendChild(h);
      const select=document.createElement('select');select.className='choice-select';
      const empty=document.createElement('option');empty.value='';empty.textContent=placeholder;select.appendChild(empty);
      options.forEach(o=>{const opt=document.createElement('option');opt.value=String(o.value);opt.textContent=o.label;select.appendChild(opt);});
      content.appendChild(select);
      const row=document.createElement('div');row.className='button-row';
      const ok=document.createElement('button');ok.className='primary';ok.textContent='Confirmar';
      const cancel=document.createElement('button');cancel.className='secondary';cancel.textContent='Cancelar';
      const finish=value=>{modal.classList.add('hidden');content.replaceChildren();resolve(value);};
      ok.onclick=()=>finish(select.value===''?null:select.value);cancel.onclick=()=>finish(null);
      row.append(ok,cancel);content.appendChild(row);modal.classList.remove('hidden');
    });
  }
  async function chooseTarget(g, data, actorUid, promptText='Elige el jugador objetivo') {
    const targets=eligibleTargets(g,data,actorUid);
    if(!targets.length) return null;
    const picked=await chooseFromDropdown(promptText,targets.map(p=>({value:p.uid,label:p.nombre||'Jugador'})),'Elige un jugador');
    return picked?targets.find(p=>p.uid===picked)||null:null;
  }
  function announce(g, tipo, texto, extra={}) {
    g.eventoVisual={id:Date.now()+Math.random(),tipo,texto,...extra};
  }
  function showPrivatePeek(card, targetName) {
    const modal=$('modal-carta'),content=$('contenido-modal-carta');if(!modal||!content)return;
    content.replaceChildren();const title=document.createElement('h2');title.textContent=`Carta de ${targetName} (solo tú puedes verla)`;content.appendChild(title);
    const visual=makeCardVisual(card,false);visual.disabled=true;content.appendChild(visual);
    const note=document.createElement('p');note.textContent='Esta información es privada y desaparecerá en 3 segundos.';content.appendChild(note);
    modal.classList.remove('hidden');window.setTimeout(()=>modal.classList.add('hidden'),3000);
  }
  function showPlayedDetails(entry) {
    const modal=$('modal-carta'),content=$('contenido-modal-carta');if(!modal||!content)return;
    content.replaceChildren();const title=document.createElement('h2');title.textContent=`${entry.nombre||'Jugador'} jugó ${entry.carta?.name||`la carta ${entry.carta?.id||''}`}`;content.appendChild(title);
    const card=makeCardVisual(entry.carta||{},false);card.disabled=true;content.appendChild(card);
    const detail=document.createElement('p');detail.textContent=entry.resultado||'Carta jugada.';content.appendChild(detail);
    if(entry.cartaVista){if(entry.uid===user?.uid){const sub=document.createElement('p');sub.textContent=`Carta que viste de ${entry.objetivoNombre||'tu objetivo'}:`;content.appendChild(sub);content.appendChild(makeCardVisual(entry.cartaVista,false));}else{const sub=document.createElement('p');sub.textContent='Carta del objetivo: oculta (solo la puede volver a ver quien jugó la carta).';content.appendChild(sub);const blank=document.createElement('div');blank.className='hidden-card-placeholder';blank.textContent='CARTA OCULTA';content.appendChild(blank);}}
    modal.classList.remove('hidden');
  }
  function eliminateOrSave(g, data, uid, cause, entry) {
    const hand=g.manos?.[uid]||[]; const held=hand[0];
    if(!held) return {saved:false, message:`${data.jugadores?.[uid]?.nombre||'El jugador'} ya estaba eliminado.`};
    if(String(held.id)==="02" || String(held.id)==="18") {
      const discarded=hand.shift();
      if(!Array.isArray(g.jugadas))g.jugadas=[];
      g.jugadas.push({uid,nombre:data.jugadores?.[uid]?.nombre||'Jugador',carta:discarded,resultado:`Descartó ${discarded.name} y se salvó del efecto: ${cause}.`});
      const replacement=(g.mazo||[]).pop();g.manos[uid]=replacement?[replacement]:[];
      return {saved:true,message:replacement?`${data.jugadores?.[uid]?.nombre||'El jugador'} descarta ${discarded.name}, roba otra carta y no muere.`:`${data.jugadores?.[uid]?.nombre||'El jugador'} se salva, pero no quedan cartas para robar.`};
    }
    if(!Array.isArray(g.jugadas))g.jugadas=[];
    if(String(held.id)==="81") { g.jugadas.push({uid,nombre:data.jugadores?.[uid]?.nombre||'Jugador',carta:held,resultado:`Daenerys fue descartada por un efecto y su jugador queda eliminado.`}); }
    g.manos[uid]=[]; return {saved:false,message:`${data.jugadores?.[uid]?.nombre||'El jugador'} queda eliminado.`};
  }
  async function resolveCardEffect(g, data, actorUid, card, entry) {
    const actorName=(data.jugadores?.[actorUid]||{}).nombre||'Jugador';
    const id=String(card.id), value=Number(card.value??id[0]);
    const addPlayed=(uid,c,result)=>{if(!Array.isArray(g.jugadas))g.jugadas=[];g.jugadas.push({uid,nombre:data.jugadores?.[uid]?.nombre||'Jugador',carta:c,resultado:result,timestamp:Date.now()});};
    if(id==='01'){
      const target=await chooseTarget(g,data,actorUid,'Theon Greyjoy: elige a un jugador al que llorar.');
      if(target){g.apuestasTheon=g.apuestasTheon||{};g.apuestasTheon[target.uid]=actorUid;entry.objetivoUid=target.uid;entry.objetivoNombre=target.nombre;entry.resultado=`${actorName} llora por ${target.nombre}. Si gana la ronda, ${actorName} obtiene un punto adicional.`;announce(g,'carta',entry.resultado,{carta:card});}
      return;
    }
    if(id==='02'){entry.resultado='Arya Stark queda descartada. Su habilidad defensiva se aplica si un efecto intenta eliminar a quien la conserva.';return;}
    if(value===1){
      const target=await chooseTarget(g,data,actorUid,'Guerrero: elige un jugador para adivinar su carta.');if(!target){entry.resultado='No se eligió objetivo.';return;}
      const raw=await chooseFromDropdown('Adivina el valor de la carta de '+(target.nombre||'tu objetivo'),[0,2,3,4,5,6,7,8,9].map(n=>({value:n,label:String(n)})),'Elige un valor (no se puede elegir 1)');if(raw===null){entry.resultado='Adivinación cancelada.';return;}
      const guess=Number(raw);
      const targetCard=(g.manos?.[target.uid]||[])[0];if(!targetCard)throw new Error('El jugador seleccionado ya no tiene una carta en la mano.');const targetValue=Number(targetCard.value??String(targetCard.id)[0]);const hit=targetValue===guess;entry.objetivoUid=target.uid;entry.objetivoNombre=target.nombre;entry.numeroElegido=guess;
      if(hit){const res=eliminateOrSave(g,data,target.uid,`ataque de ${actorName}`,entry);entry.resultado=`${actorName} eligió ${target.nombre} y adivinó ${guess}: acierto. ${res.message}`;}else entry.resultado=`${actorName} eligió ${target.nombre} y adivinó ${guess}: fallo.`;
      addHistoryEntry(g,entry.resultado,'effect');announce(g,'ataque',entry.resultado,{carta:card,numeroElegido:guess,acierto:hit});return;
    }
    if(value===2){
      const count=id==='22'?2:1;const seen=[];for(let i=0;i<count;i++){const target=await chooseTarget(g,data,actorUid,`Curioso: elige al jugador ${i+1}${count===2?' de hasta dos':''} cuya carta quieres ver en secreto.`);if(!target)break;const targetCard=(g.manos?.[target.uid]||[])[0];if(targetCard){seen.push({target,targetCard});entry.cartaVista=targetCard;entry.objetivoUid=target.uid;entry.objetivoNombre=target.nombre;if(i===0)showPrivatePeek(targetCard,target.nombre||'Jugador');}}
      entry.cartasVistas=seen.map(x=>({uid:x.target.uid,nombre:x.target.nombre,carta:x.targetCard}));entry.resultado=seen.length?`${actorName} miró en secreto la carta de ${seen.map(x=>x.target.nombre).join(' y ')}.`:'No se eligió objetivo.';addHistoryEntry(g,entry.resultado,'effect');announce(g,'carta',`${entry.resultado} Solo ${actorName} puede verlas.`,{carta:card});return;
    }
    if(value===3||id==='71'){
      let dieRule=id==='71'?'higher':'lower';if(id==='33'){const answer=await chooseFromDropdown('Tyrion Lannister: ¿qué carta debe morir?',[{value:'mayor',label:'La carta de mayor valor'},{value:'menor',label:'La carta de menor valor'}],'Elige una opción');if(answer===null){entry.resultado='Comparación cancelada.';return;}dieRule=answer==='mayor'?'higher':'lower';}
      const target=await chooseTarget(g,data,actorUid,`Estratega: elige a un jugador para comparar (muere la carta ${dieRule==='higher'?'mayor':'menor'}).`);if(!target){entry.resultado='No se eligió objetivo.';return;}
      const mine=(g.manos?.[actorUid]||[])[0],theirs=(g.manos?.[target.uid]||[])[0];if(!mine||!theirs){entry.resultado='No se pudo comparar: falta una carta.';return;}
      const mv=Number(mine.value)+(id==='42'?1:0),tv=Number(theirs.value);let loser=null;if(mv!==tv)loser=(dieRule==='higher'?(mv>tv?actorUid:target.uid):(mv<tv?actorUid:target.uid));
      entry.objetivoUid=target.uid;entry.objetivoNombre=target.nombre;entry.cartaComparada=theirs;
      if(loser){const res=eliminateOrSave(g,data,loser,`comparación de ${actorName}`,entry);entry.resultado=`Comparación: ${actorName} (${mv}) contra ${target.nombre} (${tv}). ${res.message}`;}else entry.resultado=`Comparación: ${actorName} (${mv}) contra ${target.nombre} (${tv}). Empate; nadie muere.`;
      addHistoryEntry(g,entry.resultado,'effect');announce(g,'comparacion',entry.resultado,{carta:mine,carta2:theirs});return;
    }
    if(value===4){g.protegidos=g.protegidos||{};g.protegidos[actorUid]=true;if(id==='42'){g.bonusFinalUid=actorUid;}entry.resultado=`${actorName} queda PROTEGIDO hasta que vuelva a comenzar su turno.`;addHistoryEntry(g,entry.resultado,'effect');announce(g,'carta',entry.resultado,{carta:card});return;}
    if(value===5){
      const target=await chooseTarget(g,data,actorUid,'Gemelo: elige un jugador.');if(!target){entry.resultado='No se eligió objetivo.';return;}const held=(g.manos?.[target.uid]||[])[0];entry.objetivoUid=target.uid;entry.objetivoNombre=target.nombre;if(!held){entry.resultado=`${target.nombre} ya está eliminado.`;return;}
      if(Number(held.value)===5){g.forcedWinnerUid=actorUid;entry.resultado=`${target.nombre} tenía el otro 5. ${actorName} gana la ronda.`;announce(g,'ronda',entry.resultado,{carta:card});}
      else {addPlayed(target.uid,held,`${target.nombre} descarta ${held.name} por el efecto de ${actorName}.`);entry.cartaDescartada=held;if(Number(held.value)===8){g.manos[target.uid]=[];entry.resultado=`${target.nombre} descarta a Daenerys (8) y queda eliminado.`;}else{const replacement=(g.mazo||[]).pop();g.manos[target.uid]=replacement?[replacement]:[];entry.resultado=replacement?`${target.nombre} descarta ${held.name} y roba una carta de reemplazo.`:`${target.nombre} descarta ${held.name}, pero no quedan cartas para robar; queda eliminado.`;}announce(g,'carta',entry.resultado,{carta:held});}addHistoryEntry(g,entry.resultado,'effect');return;
    }
    if(id==='61'){
      const alive=Object.keys(data.jugadores||{}).filter(uid=>(g.manos?.[uid]||[]).length>0);const pool=alive.map(uid=>g.manos[uid][0]).sort(()=>Math.random()-.5);alive.forEach((uid,i)=>g.manos[uid]=[pool[i]]);entry.resultado=`${actorName} jugó al Rey de la Noche: las cartas de los jugadores vivos se repartieron de nuevo al azar.`;addHistoryEntry(g,entry.resultado,'effect');announce(g,'carta',entry.resultado,{carta:card});return;
    }
    if(id==='62'){
      const target=await chooseTarget(g,data,actorUid,'Joffrey: elige a un jugador para intercambiar las cartas.');if(!target){entry.resultado='No se eligió objetivo.';return;}const mine=(g.manos?.[actorUid]||[])[0],theirs=(g.manos?.[target.uid]||[])[0];if(mine&&theirs){g.manos[actorUid]=[theirs];g.manos[target.uid]=[mine];entry.objetivoUid=target.uid;entry.objetivoNombre=target.nombre;entry.resultado=`${actorName} intercambió su carta con ${target.nombre}.`;announce(g,'carta',entry.resultado,{carta:card});}return;
    }
    if(id==='72') {const hand=g.manos?.[actorUid]||[];const other=hand.find(c=>c.uid!==card.uid);if([5,6].includes(Number(other?.value))){entry.resultado=`Sansa se descarta obligatoriamente porque conservas un ${other.value}.`;}else{const ans=window.confirm('¿Quieres descartar Sansa voluntariamente? Pulsa Aceptar para descartarla o Cancelar para conservarla.');if(!ans){g.manos[actorUid]=[...hand,card];entry.resultado='Sansa se conserva en la mano.';return;}}return;}
    if(id==='81'){g.manos[actorUid]=[];entry.resultado=`${actorName} descarta voluntariamente a Daenerys (8) y queda eliminado de la ronda.`;addHistoryEntry(g,entry.resultado,'effect');announce(g,'carta',entry.resultado,{carta:card});return;}
    if(id==='91'){
      const target=await chooseTarget(g,data,actorUid,'Drogon: elige un jugador no protegido para atacar.');if(!target){entry.resultado='No se eligió objetivo.';return;}const held=(g.manos?.[target.uid]||[])[0];entry.objetivoUid=target.uid;entry.objetivoNombre=target.nombre;
      if(Number(held?.value)===8)entry.resultado=`${target.nombre} tiene a Daenerys (8): Drogon no puede eliminarlo.`;
      else if(String(held?.id)==='18'){const res=eliminateOrSave(g,data,target.uid,'ataque de Drogon',entry);entry.resultado=`${target.nombre} tenía a Jon Snow. ${res.message}`;}
      else {const res=eliminateOrSave(g,data,target.uid,`ataque de Drogon de ${actorName}`,entry);entry.resultado=res.message;}
      addHistoryEntry(g,entry.resultado,'effect');announce(g,'ataque',entry.resultado,{carta:card});return;
    }
  }
  async function playCard(index) {
    try {
      const snap=await db.ref(`salas/${currentCode}`).once("value"), data=snap.val(), g=data?.juego;
      if(!g||g.turnoUid!==user.uid) throw new Error("No es tu turno."); if(g.partidaPausada)throw new Error("La partida está pausada.");
      normalizeGameForAction(g,user.uid);
      if(!g.cartaRobada) throw new Error("Primero debes robar una carta.");
      if(g.cartaJugada) throw new Error("Ya has jugado una carta en este turno.");
      g.manos=g.manos||{};g.manos[user.uid]=Array.isArray(g.manos[user.uid])?g.manos[user.uid]:[];g.jugadas=Array.isArray(g.jugadas)?g.jugadas:[];g.historial=Array.isArray(g.historial)?g.historial:[];g.protegidos=g.protegidos||{};g.apuestasTheon=g.apuestasTheon||{};
      const hand=g.manos[user.uid];
      if(index<0||index>=hand.length) throw new Error("La carta seleccionada ya no está en tu mano.");
      const card=hand.splice(index,1)[0];
      card.value=Number(card.value??String(card.id)[0]);card.name=cardName(card.id);card.characteristic=CARD_META[String(card.id)]?.[1]||"Carta";card.character=CARD_META[String(card.id)]?.[2]||"";card.effect=cardEffect(card.id);
      const playerName=(data.jugadores?.[user.uid]||{}).nombre||"Jugador";
      const entry={uid:user.uid,nombre:playerName,carta:card,resultado:`${playerName} jugó ${card.name||`la carta ${card.id||""}`}.`,timestamp:Date.now()};
      g.jugadas.push(entry);g.cartaJugada=true;g.manos[user.uid]=hand;g.ultimaCartaJugada=card;
      addHistoryEntry(g,`${playerName} juega ${card.name||`la carta ${card.id||""}`} (valor ${card.value??"—"}).`,"effect");
      // Aplicar el efecto real de la carta antes de guardar el estado compartido.
      await resolveCardEffect(g,data,user.uid,card,entry);
      // Aviso público completo. Las cartas vistas en secreto nunca se incluyen aquí.
      g.eventoVisual={id:Date.now()+Math.random(),tipo:entry.numeroElegido!==undefined?'ataque':(entry.cartaComparada?'comparacion':'carta'),jugadorUid:user.uid,jugadorNombre:playerName,carta:card,objetivoNombre:entry.objetivoNombre||'',carta2:entry.cartaComparada||null,cartaDescartada:entry.cartaDescartada||null,numeroElegido:entry.numeroElegido,acierto:entry.numeroElegido!==undefined?String(entry.resultado||'').toLowerCase().includes('acierto'):undefined,texto:entry.resultado||`${playerName} jugó ${card.name}.`};
      await db.ref(`salas/${currentCode}/juego`).set(g);selectedCard=null;
      // El efecto se guarda primero; después se avanza automáticamente al siguiente turno.
      await endTurn();
    } catch(e){fail("No se pudo jugar la carta",e);}
  }
  async function endTurn() {
    try {
      const snap=await db.ref(`salas/${currentCode}`).once("value"), data=snap.val(), g=data?.juego;
      if(!g||g.turnoUid!==user.uid) throw new Error("No es tu turno."); if(g.partidaPausada)throw new Error("La partida está pausada.");
      if(!g.cartaJugada) throw new Error("Debes robar y jugar una carta antes de terminar el turno.");
      const players=Object.values(data.jugadores||{}), index=players.findIndex(p=>p.uid===user.uid);
      const aliveNow=players.filter(p=>(g.manos?.[p.uid]||[]).length>0);
      const candidates=players.length ? Array.from({length:players.length},(_,step)=>players[(index+step+1)%players.length]).filter(p=>(g.manos?.[p.uid]||[]).length>0) : [];
      const next=candidates[0] || aliveNow[0] || players[(index+1+players.length)%Math.max(players.length,1)];
      if(!next) throw new Error("No hay jugadores disponibles para continuar la partida.");
      addHistoryEntry(g,`${(data.jugadores[user.uid]||{}).nombre||"El jugador"} termina su turno. Ahora juega ${(next||{}).nombre||"el siguiente jugador"}.`);
      g.turnoUid=next.uid; g.cartaRobada=false; g.cartaJugada=false; if(g.temporizadorActivo){g.tiempoRestanteMs=120000;g.turnoStartedAt=Date.now();}
      // La protección dura hasta que vuelve a empezar el turno de ese jugador.
      if(g.protegidos?.[next.uid]) delete g.protegidos[next.uid];
      // Cada jugador mantiene una carta en la mano. Las cartas jugadas quedan visibles en la mesa.
      if((g.manos[user.uid]||[]).length>1) g.manos[user.uid]=[g.manos[user.uid][g.manos[user.uid].length-1]];
      const livingNow=players.filter(p=>(g.manos?.[p.uid]||[]).length>0);
      if(livingNow.length===1) g.forcedWinnerUid=livingNow[0].uid;
      if((g.mazo||[]).length===0 || g.forcedWinnerUid) {
        const alive=players.filter(p=>(g.manos[p.uid]||[]).length>0);
        let high=-1, winners=[];
        alive.forEach(p=>{const c=(g.manos[p.uid]||[])[0],v=Number(c?.value??0)+((g.bonusFinalUid===p.uid)?1:0);if(v>high){high=v;winners=[p];}else if(v===high)winners.push(p);});
        if(g.forcedWinnerUid && data.jugadores?.[g.forcedWinnerUid]) winners=[data.jugadores[g.forcedWinnerUid]];
        if(winners.length===1) {
          const winner=winners[0];g.puntos=g.puntos||{};g.puntos[winner.uid]=(g.puntos[winner.uid]||0)+1;
          Object.entries(g.apuestasTheon||{}).forEach(([targetUid,bonusUid])=>{if(targetUid===winner.uid && bonusUid!==winner.uid)g.puntos[bonusUid]=(g.puntos[bonusUid]||0)+1;});
          addHistoryEntry(g,`${winner.nombre} gana la ronda y suma un punto.`,'round');
          g.eventoVisual={id:Date.now()+Math.random(),tipo:'ronda',nombre:winner.nombre,texto:`${winner.nombre} gana la ronda con una carta de valor ${high}.`,puntuaciones:{...g.puntos}};
          if(g.puntos[winner.uid]>=Number(data.puntosObjetivo||5)) {
            g.estado='finalizada';g.eventoVisual.texto=`¡${winner.nombre} gana la partida! Ha alcanzado ${g.puntos[winner.uid]} puntos.`;
          } else {
            g.ronda=(g.ronda||1)+1;
            const newDeck=makeDeck().sort(()=>Math.random()-.5), newHands={};
            players.forEach(p=>{newHands[p.uid]=[newDeck.pop()];});
            g.mazo=newDeck;g.manos=newHands;g.cartaRobada=false;g.cartaJugada=false;g.jugadas=[];g.protegidos={};g.apuestasTheon={};g.eliminados={};g.forcedWinnerUid=null;g.bonusFinalUid=null;g.turnoUid=players[Math.floor(Math.random()*players.length)].uid;if(g.temporizadorActivo){g.tiempoRestanteMs=120000;g.turnoStartedAt=Date.now();g.partidaPausada=false;}
          }
        } else {
          addHistoryEntry(g,'La ronda termina en empate; no se asigna punto.','round');
          g.eventoVisual={id:Date.now()+Math.random(),tipo:'ronda',texto:'La ronda termina en empate. Nadie suma puntos.',puntuaciones:{...(g.puntos||{})}};
          g.ronda=(g.ronda||1)+1;const newDeck=makeDeck().sort(()=>Math.random()-.5),newHands={};players.forEach(p=>newHands[p.uid]=[newDeck.pop()]);
          g.mazo=newDeck;g.manos=newHands;g.cartaRobada=false;g.cartaJugada=false;g.jugadas=[];g.protegidos={};g.apuestasTheon={};g.eliminados={};g.forcedWinnerUid=null;g.bonusFinalUid=null;g.turnoUid=players[Math.floor(Math.random()*players.length)].uid;if(g.temporizadorActivo){g.tiempoRestanteMs=120000;g.turnoStartedAt=Date.now();g.partidaPausada=false;}
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
    $("cerrar-modal-carta")?.addEventListener("click",()=>{ $("modal-carta")?.classList.add("hidden"); if(catalogDetailReturn){$("modal-reglas")?.classList.remove("hidden");catalogDetailReturn=false;} });
    $("modal-carta")?.addEventListener("click",e=>{if(e.target.id==="modal-carta"){e.currentTarget.classList.add("hidden");if(catalogDetailReturn){$("modal-reglas")?.classList.remove("hidden");catalogDetailReturn=false;}}});
    $("btn-historial")?.addEventListener("click",()=>$("modal-historial")?.classList.remove("hidden"));
    $("cerrar-modal-historial")?.addEventListener("click",()=>$("modal-historial")?.classList.add("hidden"));
    $("btn-reglas")?.addEventListener("click",()=>{renderCatalog();$("modal-reglas")?.classList.remove("hidden");});
    $("btn-como-jugar")?.addEventListener("click",()=>$("modal-como-jugar")?.classList.remove("hidden"));
    $("cerrar-reglas")?.addEventListener("click",()=>$("modal-reglas")?.classList.add("hidden"));
    $("cerrar-como-jugar")?.addEventListener("click",()=>$("modal-como-jugar")?.classList.add("hidden"));
    $("btn-crear-partida").addEventListener("click",()=>{say("");showScreen("pantalla-crear");});
    $("btn-unirse-partida").addEventListener("click",()=>{say("");showScreen("pantalla-unirse");});
    $("btn-volver-inicio-crear").addEventListener("click",()=>showScreen("pantalla-inicio"));
    $("btn-volver-inicio-unirse").addEventListener("click",()=>showScreen("pantalla-inicio"));
    $("numero-jugadores").addEventListener("change",()=>{$("puntos-objetivo").value=Number($("numero-jugadores").value)<=4?5:3;});
    $("btn-generar-partida").addEventListener("click",createRoom); $("btn-pausar")?.addEventListener("click",togglePause); $("cerrar-final")?.addEventListener("click",()=>$("pantalla-final")?.classList.add("hidden"));
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
      if(!timerInterval)timerInterval=window.setInterval(()=>{if(room?.juego)updateTimerUI(room.juego);},1000);
      console.log("Aplicación cargada. Versión JDT v1.21.");
    } catch(e) {setStatus("Error de configuración","bad");fail("No se pudo iniciar la aplicación",e);}
  }
  document.addEventListener("DOMContentLoaded",boot);
})();
