// Calendário de jogos Sub-11 2026/27
// Escolhe-se o jogo para que o atleta foi convocado -> abre o Google Calendar já preenchido.
// O evento no calendário cobre: viagem de ida + chegada ao campo (antecedência) + jogo (1 h 30) + viagem de regresso
const JOGO_MIN = 90;
const CHAVE = "convocados-v1";   // localStorage: { idJogo: true }
const CHAVE_DEF = "definicoes-v1"; // localStorage: viagem e antecedência de cada utilizador
const PADRAO = { configurado: false, modo: "estimativa", ajuste: 0, fixo: 45, antecedencia: 60 };

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const dataDe = (g) => new Date(g.inicio);
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDia = (d) => `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;

// Fim de semana identificado pelo sábado (domingo recua um dia)
function chaveSemana(d) {
  const s = new Date(d);
  if (s.getDay() === 0) s.setDate(s.getDate() - 1);
  return ymd(s);
}

function lerEstado() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; }
}
function gravarEstado(e) {
  try { localStorage.setItem(CHAVE, JSON.stringify(e)); } catch { /* modo privado */ }
}

function lerDefinicoes() {
  try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_DEF)) }; } catch { return { ...PADRAO }; }
}
function gravarDefinicoes(d) {
  try { localStorage.setItem(CHAVE_DEF, JSON.stringify(d)); } catch { /* modo privado */ }
}
let def = lerDefinicoes();

const jogos = window.JOGOS.map((g) => ({ ...g, d: dataDe(g) }));
const porSemana = new Map();
for (const g of jogos) {
  const k = chaveSemana(g.d);
  if (!porSemana.has(k)) porSemana.set(k, []);
  porSemana.get(k).push(g);
}
const semanas = [...porSemana.keys()].sort();
let estado = lerEstado();

// ---------- Calendário ----------
const somaMin = (d, m) => new Date(d.getTime() + m * 60000);
// Minutos de viagem (ida; o regresso é igual): estimativa do campo + ajuste, ou tempo fixo
function viagemMin(g) {
  const est = (window.VIAGEM || {})[g.campo];
  if (def.modo === "estimativa" && est != null) return Math.max(0, est + def.ajuste);
  return def.fixo;
}
const inicioEvento = (g) => somaMin(g.d, -(viagemMin(g) + def.antecedencia));
const fimEvento = (g) => somaMin(g.d, JOGO_MIN + viagemMin(g));
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

function titulo(g) {
  const casa = g.emCasa ? "(casa)" : "(fora)";
  return `Jogo Sub-11 · ${pad(g.d.getHours())}h${pad(g.d.getMinutes())} - Equipa ${g.equipa} vs ${g.adversario} ${casa}`;
}
function detalhes(g) {
  return `Jogo às ${hhmm(g.d)} · sair às ${hhmm(inicioEvento(g))}, chegar ao campo às ${hhmm(somaMin(g.d, -def.antecedencia))}, ` +
    `fim do jogo às ${hhmm(somaMin(g.d, JOGO_MIN))}\n` +
    `Liga Sub-11 Futebol 7 · Série ${g.serie} · Jornada ${g.jornada}\nJogo ${g.id}`;
}
function linkGoogle(g) {
  const p = new URLSearchParams({
    action: "TEMPLATE", text: titulo(g), dates: `${stamp(inicioEvento(g))}/${stamp(fimEvento(g))}`,
    ctz: "Europe/Lisbon", location: g.campo, details: detalhes(g),
  });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}
const linkMapa = (g) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(g.campo);

// ---------- Interface ----------
function conv(g) { return !!estado[g.id]; }

function textoViagem(g) {
  const est = (window.VIAGEM || {})[g.campo];
  if (def.modo === "estimativa" && est != null) return `Viagem ≈ ${viagemMin(g)} min (a partir do ponto de partida do grupo)`;
  return `Viagem ${viagemMin(g)} min (definida por si)`;
}

function cartao(g) {
  const el = document.createElement("article");
  el.className = `card ${g.equipa === "G" ? "g" : ""} ${conv(g) ? "on" : ""}`;
  el.innerHTML = `
    <div class="topo"><span class="equipa">Equipa ${g.equipa}</span><span class="hora">${hhmm(g.d)}</span></div>
    <p class="vs">Equipa ${g.equipa} ${g.emCasa ? "recebe" : "visita"} ${g.adversario}</p>
    <p class="meta">${fmtDia(g.d)} · Jornada ${g.jornada} · ${g.emCasa ? "Em casa" : "Fora"}</p>
    <p class="meta"><a href="${linkMapa(g)}" target="_blank" rel="noopener noreferrer">${g.campo}</a></p>
    <p class="meta">${textoViagem(g)}</p>
    <div class="acoes"></div>`;
  const acoes = el.querySelector(".acoes");

  const principal = document.createElement("a");
  principal.className = "btn main";
  principal.target = "_blank"; principal.rel = "noopener noreferrer";
  principal.href = linkGoogle(g);
  principal.textContent = conv(g) ? "✓ Convocado · adicionar de novo" : "Convocado → adicionar ao calendário";
  principal.addEventListener("click", (ev) => {
    if (!def.configurado && $("def-form")) { // primeira vez: pedir a viagem e a antecedência antes de agendar
      ev.preventDefault();
      abrirDefinicoes(g);
      return;
    }
    estado[g.id] = true; gravarEstado(estado);
    setTimeout(render, 0);
  });
  acoes.append(principal);

  if (conv(g)) {
    const rm = document.createElement("button");
    rm.className = "btn sec"; rm.textContent = "Não convocado";
    rm.addEventListener("click", () => { delete estado[g.id]; gravarEstado(estado); render(); });
    acoes.append(rm);
  }
  return el;
}

// Texto "17–18 out" (o domingo pode cair no mês seguinte)
function rotuloSemana(k) {
  const sab = new Date(k + "T12:00"), dom = new Date(sab.getTime() + 86400000);
  const mes = (d) => MESES[d.getMonth()];
  return sab.getMonth() === dom.getMonth()
    ? `${sab.getDate()}–${dom.getDate()} ${mes(sab)}`
    : `${sab.getDate()} ${mes(sab)} – ${dom.getDate()} ${mes(dom)}`;
}

let mostrarAnteriores = false;
// Fim de semana atual: o domingo ainda conta como "esta semana"
const primeiraAtual = (() => {
  const hoje = ymd(new Date(Date.now() - 86400000));
  const i = semanas.findIndex((k) => k >= hoje);
  return i === -1 ? semanas.length : i;
})();

function render() {
  const box = $("jogos");
  box.replaceChildren();
  semanas.forEach((k, i) => {
    if (i < primeiraAtual && !mostrarAnteriores) return;
    const lista = porSemana.get(k);
    const sec = document.createElement("section");
    sec.className = "semana-bloco";
    const h = document.createElement("h2");
    h.textContent = `${rotuloSemana(k)} · ${i === primeiraAtual ? "este fim de semana" : "jornada " + lista[0].jornada}`;
    sec.append(h);
    if (lista.filter(conv).length >= 2) {
      const av = document.createElement("p");
      av.className = "aviso";
      av.textContent = "Atenção: há mais do que um jogo marcado como convocado neste fim de semana.";
      sec.append(av);
    }
    for (const g of lista) sec.append(cartao(g));
    box.append(sec);
  });
  if (!box.children.length) box.innerHTML = '<p class="vazio">Já não há jogos por disputar.</p>';

  const t = $("anteriores");
  t.hidden = primeiraAtual === 0;
  t.textContent = mostrarAnteriores ? "Esconder jogos anteriores" : "Mostrar jogos anteriores";

  const ul = $("convocados");
  ul.replaceChildren();
  const todos = jogos.filter(conv);
  $("resumo").hidden = !todos.length;
  for (const g of todos) {
    const li = document.createElement("li");
    li.textContent = `${fmtDia(g.d)} ${hhmm(g.d)} · Equipa ${g.equipa} · ${g.emCasa ? "vs" : "@"} ${g.adversario}`;
    ul.append(li);
  }
}

$("anteriores").onclick = () => { mostrarAnteriores = !mostrarAnteriores; render(); };
render();

// ---------- Definições (viagem e antecedência) ----------
let jogoPendente = null; // jogo que o utilizador tocou antes de ter definições

function abrirDefinicoes(g) {
  jogoPendente = g || null;
  $("def-modo-est").checked = def.modo === "estimativa";
  $("def-modo-fixo").checked = def.modo === "fixo";
  $("def-ajuste").value = def.ajuste;
  $("def-fixo").value = def.fixo;
  $("def-antec").value = def.antecedencia;
  $("def-continuar").textContent = g ? "Guardar e adicionar ao calendário" : "Guardar";
  $("definicoes").hidden = false;
  $("definicoes").scrollIntoView({ behavior: "smooth", block: "start" });
}

const inteiro = (id, min, max, porOmissao) => {
  const v = Math.round(Number($(id).value));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : porOmissao;
};

if ($("def-form")) { // tolera uma página guardada em memória sem o painel de definições
  $("abrir-def").onclick = () => abrirDefinicoes(null);
  $("def-cancelar").onclick = () => { jogoPendente = null; $("definicoes").hidden = true; };
  $("def-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    def = {
      configurado: true,
      modo: $("def-modo-fixo").checked ? "fixo" : "estimativa",
      ajuste: inteiro("def-ajuste", -30, 60, 0),
      fixo: inteiro("def-fixo", 0, 180, 45),
      antecedencia: inteiro("def-antec", 0, 180, 60),
    };
    gravarDefinicoes(def);
    $("definicoes").hidden = true;
    const g = jogoPendente; jogoPendente = null;
    if (g) {
      estado[g.id] = true; gravarEstado(estado);
      window.open(linkGoogle(g), "_blank", "noopener,noreferrer");
    }
    render();
  });
}
