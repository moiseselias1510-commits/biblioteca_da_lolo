/* ============================================================
   NOSSA BIBLIOTECA — app.js
   ============================================================ */

const app  = document.getElementById("app");
const root = document.getElementById("modal-root");

let mode  = null;
let books = [];
let editingId = null;
let searchTerm = "";

const $  = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[c]
));

const configured = () => API_URL && !API_URL.includes("COLE_AQUI");

const toast = (msg, kind = "info") => {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "toast show " + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.className = "toast " + kind, 2600);
};

function jsonp(params){
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const q  = new URLSearchParams({ ...params, callback: cb });
    const s  = document.createElement("script");
    const cleanup = () => { delete window[cb]; s.remove(); };
    window[cb] = data => { cleanup(); resolve(data); };
    s.onerror = () => { cleanup(); reject(new Error("Falha de rede")); };
    s.src = API_URL + "?" + q.toString();
    document.body.appendChild(s);
    setTimeout(() => { if (window[cb]) { cleanup(); reject(new Error("Tempo esgotado")); } }, 12000);
  });
}

async function postAction(payload){
  const body = new URLSearchParams(payload);
  try{
    const r = await fetch(API_URL, { method: "POST", body });
    const data = await r.json().catch(() => null);
    if (data) return data;
  }catch(_){}
  await fetch(API_URL, { method: "POST", body, mode: "no-cors" });
  return { ok: true, _blind: true };
}

function showError(t){ toast(t, "err"); }

function applyA11y(){
  const saved = localStorage.getItem("a11y_mode");

  $$(".a11y-pill").forEach(b => b.classList.remove("active"));
  const map = { "":"default", "hc":"hc", "cv-protanopia":"cv-protanopia",
                "cv-deuteranopia":"cv-deuteranopia", "cv-tritanopia":"cv-tritanopia" };
  const pills = $$(".a11y-pill");
  if (saved && saved !== "" && pills[0]){
    const idx = ["hc","cv-protanopia","cv-deuteranopia","cv-tritanopia"].indexOf(saved);
    if (idx >= 0 && pills[idx]) pills[idx].classList.add("active");
  }
  document.body.dataset.a11y = saved || "";
}

function cycleA11y(){
  const order = ["","hc","cv-protanopia","cv-deuteranopia","cv-tritanopia"];
  const cur   = document.body.dataset.a11y || "";
  const next  = order[(order.indexOf(cur) + 1) % order.length];
  localStorage.setItem("a11y_mode", next);
  applyA11y();
  toast(
    next === ""        ? "Modo padrão" :
    next === "hc"      ? "Alto contraste" :
    next === "cv-protanopia"  ? "Protanopia" :
    next === "cv-deuteranopia" ? "Deuteranopia" :
    "Tritanopia"
  );
}

function login(){
  setBackground("login-bg");
  app.innerHTML = `
    <main class="shell">
      <section class="card login">
        <div class="symbol" aria-hidden="true">📚</div>
        <h1>Nossa Biblioteca</h1>
        <p>Um cantinho para guardar as histórias que ela leu.</p>
        <label for="pass">Senha</label>
        <input id="pass" class="input" type="password" inputmode="numeric"
               maxlength="4" placeholder="Digite a senha" autocomplete="off">
        <button class="btn primary block" id="enterBtn">Entrar</button>
        <div class="actions-row">
          <button class="a11y-pill" id="a11y" title="Alternar modo de acessibilidade">
            <span aria-hidden="true">♿</span> Acessibilidade
          </button>
        </div>
        <div id="err" class="notice hidden"></div>
      </section>
    </main>`;

  $("#enterBtn").addEventListener("click", enter);
  $("#pass").addEventListener("keydown", e => { if (e.key === "Enter") enter(); });
  $("#a11y").addEventListener("click", cycleA11y);
  applyA11y();

  if (!configured()){
    showError("Antes de usar, coloque a URL do Google Apps Script no arquivo config.js.");
  }
}

function enter(){
  if (!configured()) return showError("O site ainda não está conectado ao Google Sheets.");
  const p = $("#pass").value.trim();
  if (p === "0402"){ mode = "user";  return userPage(); }
  if (p === "1510"){ mode = "owner"; return ownerPage(); }
  showError("Senha incorreta.");
}

function logout(){ mode = null; books = []; searchTerm = ""; editingId = null; login(); }

function setBackground(type){ document.body.className = type; }

function head(title, sub){
  return `
    <header>
      <div>
        <h1>${esc(title)}</h1>
        <p>${esc(sub)}</p>
      </div>
      <div class="header-actions">
        <button class="a11y-pill" title="Alternar modo de acessibilidade">
          <span aria-hidden="true">♿</span>
        </button>
        <button class="btn secondary" id="logoutBtn">Sair</button>
      </div>
    </header>`;
}

function bindHeader(){
  $("#logoutBtn").addEventListener("click", logout);
  const a = $(".a11y-pill");
  if (a) a.addEventListener("click", cycleA11y);
  applyA11y();
}

/* ============================================================
   ÁREA DELA — cadastrar + listar + editar + apagar + pesquisar
   ============================================================ */

async function userPage(){
  setBackground("her-bg");
  app.innerHTML = `
    <main class="shell">
      ${head("Minha Biblioteca", "Cadastre, edite e pesquise os livros que você já leu.")}
      <section class="card section">
        <h2><span aria-hidden="true">➕</span> Adicionar livro</h2>
        <form id="bookForm" novalidate>
          <div class="formgrid">
            <div>
              <label for="titulo">Nome do livro *</label>
              <input id="titulo" class="input" required autocomplete="off">
            </div>
            <div>
              <label for="autor">Autor *</label>
              <input id="autor" class="input" required autocomplete="off">
            </div>
            <div>
              <label for="genero">Gênero *</label>
              <input id="genero" class="input" placeholder="Romance, terror..." required autocomplete="off">
            </div>
            <div>
              <label for="nota">Nota (0 a 10) *</label>
              <input id="nota" class="input" type="number" min="0" max="10" step="0.1" required>
            </div>
            <div class="full">
              <label for="mais"><span aria-hidden="true">❤️</span> Parte que mais gostou</label>
              <textarea id="mais" class="input" rows="3"></textarea>
            </div>
            <div class="full">
              <label for="menos"><span aria-hidden="true">💔</span> Parte que menos gostou</label>
              <textarea id="menos" class="input" rows="3"></textarea>
            </div>
            <div class="full">
              <label for="porque"><span aria-hidden="true">💭</span> Por que comprou esse livro?</label>
              <textarea id="porque" class="input" rows="3"></textarea>
            </div>
            <div class="full">
              <label for="opiniao"><span aria-hidden="true">📝</span> O que achou do livro no geral?</label>
              <textarea id="opiniao" class="input" rows="3"></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn primary" type="submit">Salvar livro</button>
          </div>
        </form>
      </section>

      <section class="card section">
        <div class="library-head">
          <h2><span aria-hidden="true">📖</span> Seus livros</h2>
          <span class="badge" id="bookCount">0</span>
        </div>

        <div class="searchbar">
          <input id="search" class="input" placeholder="🔎 Pesquisar por título, autor ou gênero…">
          <select id="sortBy" class="input" aria-label="Ordenar por">
            <option value="data_desc">Mais recentes</option>
            <option value="data_asc">Mais antigos</option>
            <option value="nota_desc">Maior nota</option>
            <option value="nota_asc">Menor nota</option>
            <option value="titulo_asc">Título (A–Z)</option>
          </select>
        </div>

        <div id="bookList" class="book-list" aria-live="polite">
          <div class="empty state">Carregando livros…</div>
        </div>
      </section>
    </main>`;

  bindHeader();
  $("#bookForm").addEventListener("submit", onAddOrUpdate);
  $("#search").addEventListener("input", e => { searchTerm = e.target.value.toLowerCase().trim(); renderBookList(); });
  $("#sortBy").addEventListener("change", e => { renderBookList(e.target.value); });

  await loadBooks();
  renderBookList();
}

async function loadBooks(){
  try{
    const data = await jsonp({ action: "list", password: "0402" });
    if (!data || !data.ok) throw new Error(data?.error || "Falha ao carregar");
    books = data.books || [];
  }catch(e){
    books = [];
    $("#bookList").innerHTML = `
      <div class="empty state err">
        Não consegui carregar os livros salvos.<br>
        <small>${esc(e.message)}</small>
        <div style="margin-top:12px">
          <button class="btn secondary" id="retryLoad">Tentar novamente</button>
        </div>
      </div>`;
    $("#retryLoad")?.addEventListener("click", async () => {
      await loadBooks(); renderBookList();
    });
  }
}

async function onAddOrUpdate(e){
  e.preventDefault();
  const titulo  = $("#titulo").value.trim();
  const autor   = $("#autor").value.trim();
  const genero  = $("#genero").value.trim();
  const notaRaw = $("#nota").value;
  const nota    = notaRaw === "" ? NaN : Number(notaRaw);

  if (!titulo)  return showError("Faltou o nome do livro.");
  if (!autor)   return showError("Faltou o autor.");
  if (!genero)  return showError("Faltou o gênero.");
  if (!Number.isFinite(nota) || nota < 0 || nota > 10) return showError("A nota precisa ser entre 0 e 10.");

  const payload = {
    action: editingId ? "update" : "add",
    password: "0402",
    titulo, autor, genero,
    nota: String(nota),
    mais:    $("#mais").value,
    menos:   $("#menos").value,
    porque:  $("#porque").value,
    opiniao: $("#opiniao").value
  };
  if (editingId) payload.id = editingId;

  const btn = e.target.querySelector("button[type=submit]");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = editingId ? "Atualizando…" : "Salvando…";

  try{
    await postAction(payload);
    toast(editingId ? "✏️ Livro atualizado." : "📚 Livro salvo!", "ok");
    if (editingId){
      const idx = books.findIndex(b => b.id === editingId);
      if (idx >= 0){
        books[idx] = {
          ...books[idx], titulo, autor, genero, nota,
          mais: $("#mais").value, menos: $("#menos").value,
          porque: $("#porque").value, opiniao: $("#opiniao").value
        };
      }
    } else {
      await loadBooks();
    }
    resetForm();
    renderBookList();
  }catch(err){
    showError("Não foi possível salvar. " + (err?.message || ""));
  }finally{
    btn.disabled = false;
    btn.textContent = old;
  }
}

function resetForm(){
  editingId = null;
  $("#bookForm").reset();
  const btn = $("#bookForm button[type=submit]");
  btn.textContent = "Salvar livro";
  $(".section h2").innerHTML = `<span aria-hidden="true">➕</span> Adicionar livro`;
}

function getFilteredSorted(sortKey){
  let list = books.slice();
  if (searchTerm){
    const t = searchTerm;
    list = list.filter(b =>
      (b.titulo||"").toLowerCase().includes(t) ||
      (b.autor||"").toLowerCase().includes(t) ||
      (b.genero||"").toLowerCase().includes(t)
    );
  }
  const cmp = {
    data_desc:   (a,b) => (b.data||"").localeCompare(a.data||""),
    data_asc:    (a,b) => (a.data||"").localeCompare(b.data||""),
    nota_desc:   (a,b) => Number(b.nota) - Number(a.nota),
    nota_asc:    (a,b) => Number(a.nota) - Number(b.nota),
    titulo_asc:  (a,b) => (a.titulo||"").localeCompare(b.titulo||"", "pt-BR")
  }[sortKey || "data_desc"];
  list.sort(cmp);
  return list;
}

function renderBookList(sortKey){
  const host = $("#bookList");
  const badge= $("#bookCount");
  if (!host) return;

  const list = getFilteredSorted(sortKey || ($("#sortBy")?.value || "data_desc"));
  if (badge) badge.textContent = books.length;

  if (books.length === 0){
    host.innerHTML = `<div class="empty state">Nenhum livro cadastrado ainda. ✨</div>`;
    return;
  }
  if (list.length === 0){
    host.innerHTML = `<div class="empty state">Nenhum livro encontrado para “${esc(searchTerm)}”.</div>`;
    return;
  }

  host.innerHTML = list.map(b => bookCard(b)).join("");

  $$(".book-card [data-act]").forEach(btn => {
    btn.addEventListener("click", e => {
      const card = e.currentTarget.closest(".book-card");
      const id = card.dataset.id;
      const act = e.currentTarget.dataset.act;
      if (act === "edit")   openEdit(id);
      if (act === "delete") askDelete(id);
    });
  });
}

function bookCard(b){
  const nota = Number(b.nota) || 0;
  const stars = "★".repeat(Math.round(nota / 2)) + "☆".repeat(5 - Math.round(nota / 2));
  return `
    <article class="book-card" data-id="${esc(b.id)}">
      <div class="book-card-top">
        <div class="book-card-id">
          <h3>${esc(b.titulo || "(sem título)")}</h3>
          <small>${esc(b.autor || "?")} · ${esc(b.genero || "?")} · ${esc((b.data||"").slice(0,10))}</small>
        </div>
        <div class="book-card-grade">
          <span class="stars" aria-label="Nota ${nota}">${stars}</span>
          <strong>${nota.toFixed(1)}</strong>
        </div>
      </div>

      <div class="book-card-body">
        ${b.mais      ? `<p><b>❤️ Mais gostou:</b> ${esc(b.mais)}</p>` : ""}
        ${b.menos     ? `<p><b>💔 Menos gostou:</b> ${esc(b.menos)}</p>` : ""}
        ${b.porque    ? `<p><b>💭 Por que comprou:</b> ${esc(b.porque)}</p>` : ""}
        ${b.opiniao   ? `<p><b>📝 Opinião:</b> ${esc(b.opiniao)}</p>` : ""}
      </div>

      <div class="book-card-actions">
        <button class="btn secondary" data-act="edit"   aria-label="Editar ${esc(b.titulo)}">
          <span aria-hidden="true">✏️</span> Editar
        </button>
        <button class="btn danger"    data-act="delete" aria-label="Apagar ${esc(b.titulo)}">
          <span aria-hidden="true">🗑️</span> Apagar
        </button>
      </div>
    </article>`;
}

function openEdit(id){
  const b = books.find(x => x.id === id);
  if (!b) return showError("Livro não encontrado.");
  editingId = id;

  root.innerHTML = `
    <div class="modal-backdrop" id="closeBg"></div>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="editTitle">
      <header>
        <h2 id="editTitle">✏️ Editar livro</h2>
        <button class="icon-btn" id="closeX" aria-label="Fechar">✕</button>
      </header>
      <form id="editForm">
        <div class="formgrid">
          <div><label>Nome *</label><input id="e_titulo" class="input" required value="${esc(b.titulo)}"></div>
          <div><label>Autor *</label><input id="e_autor"  class="input" required value="${esc(b.autor)}"></div>
          <div><label>Gênero *</label><input id="e_genero" class="input" required value="${esc(b.genero)}"></div>
          <div><label>Nota *</label><input id="e_nota" class="input" type="number" min="0" max="10" step="0.1" required value="${Number(b.nota)||0}"></div>
          <div class="full"><label>❤️ Mais gostou</label><textarea id="e_mais"    class="input" rows="3">${esc(b.mais||"")}</textarea></div>
          <div class="full"><label>💔 Menos gostou</label><textarea id="e_menos"  class="input" rows="3">${esc(b.menos||"")}</textarea></div>
          <div class="full"><label>💭 Por que comprou</label><textarea id="e_porque" class="input" rows="3">${esc(b.porque||"")}</textarea></div>
          <div class="full"><label>📝 Opinião</label><textarea id="e_opiniao" class="input" rows="3">${esc(b.opiniao||"")}</textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancelBtn">Cancelar</button>
          <button type="submit" class="btn primary"   id="saveBtn">Salvar alterações</button>
        </div>
      </form>
    </section>`;

  const close = () => { root.innerHTML = ""; editingId = null; };
  $("#closeBg").addEventListener("click", close);
  $("#closeX").addEventListener("click",  close);
  $("#cancelBtn").addEventListener("click", close);
  document.addEventListener("keydown", escClose);
  function escClose(e){ if (e.key === "Escape"){ close(); document.removeEventListener("keydown", escClose); } }

  $("#editForm").addEventListener("submit", async e => {
    e.preventDefault();
    const payload = {
      action: "update", password: "0402", id: editingId,
      titulo: $("#e_titulo").value.trim(),
      autor:  $("#e_autor").value.trim(),
      genero: $("#e_genero").value.trim(),
      nota:   $("#e_nota").value,
      mais:    $("#e_mais").value,
      menos:   $("#e_menos").value,
      porque:  $("#e_porque").value,
      opiniao: $("#e_opiniao").value
    };
    const btn = $("#saveBtn"); btn.disabled = true; btn.textContent = "Salvando…";
    try{
      await postAction(payload);
      const idx = books.findIndex(x => x.id === editingId);
      if (idx >= 0){
        books[idx] = {...books[idx],
          titulo: payload.titulo, autor: payload.autor, genero: payload.genero,
          nota: Number(payload.nota)||0,
          mais: payload.mais, menos: payload.menos,
          porque: payload.porque, opiniao: payload.opiniao
        };
      }
      toast("✏️ Livro atualizado.", "ok");
      close();
      renderBookList();
    }catch(err){
      showError("Falha ao atualizar. " + (err?.message||""));
    }finally{
      btn.disabled = false; btn.textContent = "Salvar alterações";
    }
  });
}

function askDelete(id){
  const b = books.find(x => x.id === id);
  if (!b) return;
  root.innerHTML = `
    <div class="modal-backdrop" id="closeBg"></div>
    <section class="modal small" role="dialog" aria-modal="true">
      <header><h2>🗑️ Apagar livro?</h2><button class="icon-btn" id="closeX" aria-label="Fechar">✕</button></header>
      <p class="confirm-text">
        Tem certeza que quer apagar <b>“${esc(b.titulo)}”</b>?
        Essa ação não pode ser desfeita.
      </p>
      <div class="modal-actions">
        <button class="btn secondary" id="cancelBtn">Cancelar</button>
        <button class="btn danger"    id="okBtn">Apagar</button>
      </div>
    </section>`;
  const close = () => { root.innerHTML = ""; };
  $("#closeBg").addEventListener("click", close);
  $("#closeX").addEventListener("click", close);
  $("#cancelBtn").addEventListener("click", close);

  $("#okBtn").addEventListener("click", async () => {
    const btn = $("#okBtn"); btn.disabled = true; btn.textContent = "Apagando…";
    try{
      await postAction({ action: "delete", password: "0402", id });
      books = books.filter(x => x.id !== id);
      toast("🗑️ Livro apagado.", "ok");
      close();
      renderBookList();
    }catch(err){
      btn.disabled = false; btn.textContent = "Apagar";
      showError("Falha ao apagar. " + (err?.message||""));
    }
  });
}

/* ============================================================
   PAINEL (SEU) — estatísticas
   ============================================================ */

async function ownerPage(){
  setBackground("him-bg");
  app.innerHTML = `
    <main class="shell">
      ${head("Painel da Biblioteca", "Conheça os gostos literários dela.")}
      <div class="loading card section">Carregando dados…</div>
    </main>`;
  bindHeader();
  try{
    const data = await jsonp({ action: "list", password: "1510" });
    if (!data.ok) throw new Error(data.error || "Erro");
    books = data.books || [];
    renderOwner();
  }catch(e){
    app.innerHTML = `
      <main class="shell">
        ${head("Painel da Biblioteca", "Erro ao carregar.")}
        <section class="card section">
          <p class="err">Não consegui acessar a planilha. Confira a URL do Apps Script e a publicação como aplicativo da Web.</p>
          <button class="btn secondary" id="retry">Tentar novamente</button>
        </section>
      </main>`;
    bindHeader();
    $("#retry").addEventListener("click", ownerPage);
  }
}

function renderOwner(){
  const n = books.length;
  const avg = n ? (books.reduce((a,b)=>a+Number(b.nota),0)/n).toFixed(1) : "—";
  const counts = {};
  books.forEach(b => counts[b.genero] = (counts[b.genero]||0)+1);
  const genres = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const hi = n ? [...books].sort((a,b)=>Number(b.nota)-Number(a.nota))[0] : null;
  const lo = n ? [...books].sort((a,b)=>Number(a.nota)-Number(b.nota))[0] : null;

  app.innerHTML = `
    <main class="shell">
      ${head("Painel da Biblioteca", "Estatísticas calculadas diretamente da sua planilha.")}

      <section class="stats">
        <div class="card stat"><b>${n}</b><span>Livros</span></div>
        <div class="card stat"><b>${avg}</b><span>Nota média</span></div>
        <div class="card stat"><b>${esc(genres[0]?.[0]||"—")}</b><span>Gênero favorito</span></div>
        <div class="card stat"><b>${hi? esc(hi.nota) : "—"}</b><span>Maior nota</span></div>
      </section>

      <div class="grid two">
        <section class="card section">
          <h2>🏆 Destaques</h2>
          ${hi ? `
            <article class="hl">
              <h3>${esc(hi.titulo)} <small> · ${esc(hi.autor)}</small></h3>
              <p class="biggrade">⭐ ${esc(hi.nota)}/10</p>
              ${hi.opiniao ? `<p>“${esc(hi.opiniao)}”</p>` : `<p class="muted">Sem opinião geral.</p>`}
            </article>
            <hr>
            <article class="hl">
              <h3 style="font-size:1.15rem">Menor nota</h3>
              <p><b>${esc(lo.titulo)}</b> — ⭐ ${esc(lo.nota)}/10</p>
              ${lo.opiniao ? `<p class="muted">“${esc(lo.opiniao)}”</p>` : ``}
            </article>` : `<p class="muted">Nenhum livro cadastrado.</p>`}
        </section>

        <section class="card section">
          <h2>🏷️ Gêneros</h2>
          ${genres.length ? genres.map(([g,c])=>`
            <div class="barrow">
              <div><span>${esc(g)}</span><span>${c}</span></div>
              <i style="width:${(c/n*100).toFixed(1)}%"></i>
            </div>`).join("")
          : `<p class="muted">Sem dados ainda.</p>`}
        </section>
      </div>

      <section class="card section">
        <h2>📚 Livros cadastrados</h2>
        ${books.length ? books.map(b => `
          <article class="book-card owner">
            <div class="book-card-top">
              <div class="book-card-id">
                <h3>${esc(b.titulo)}</h3>
                <small>${esc(b.autor)} · ${esc(b.genero)}</small>
              </div>
              <div class="book-card-grade"><strong>⭐ ${esc(b.nota)}</strong></div>
            </div>
            ${b.opiniao ? `<p class="muted">“${esc(b.opiniao)}”</p>` : ""}
          </article>`).join("")
        : `<p class="muted">Nenhum livro cadastrado.</p>`}
      </section>
    </main>`;
  bindHeader();
}

login();
