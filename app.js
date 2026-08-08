const app=document.getElementById("app");
function setBackground(type){document.body.className=type}
let mode=null, books=[];

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const configured=()=>API_URL && !API_URL.includes("COLE_AQUI");

function login(){
 setBackground("login-bg");
 app.innerHTML=`<main class="shell"><section class="card login">
 <div class="symbol">📚</div><h1>Nossa Biblioteca</h1>
 <p>Um cantinho para guardar as histórias que ela leu.</p>
 <label>Senha</label><input id="pass" class="input" type="password" inputmode="numeric" maxlength="4" placeholder="Digite a senha">
 <button class="btn primary" onclick="enter()">Entrar</button>
 <div id="err" class="notice hidden"></div>
 </section></main>`;
 document.getElementById("pass").addEventListener("keydown",e=>{if(e.key==="Enter")enter()});
 if(!configured()) showError("Antes de usar, coloque a URL do Google Apps Script no arquivo config.js.");
}
function showError(t){const e=document.getElementById("err");if(e){e.textContent=t;e.classList.remove("hidden")}}
function enter(){
 const p=document.getElementById("pass").value;
 if(!configured()) return showError("O site ainda não está conectado ao Google Sheets.");
 if(p==="0402"){mode="user";userPage()}
 else if(p==="1510"){mode="owner";ownerPage()}
 else showError("Senha incorreta.");
}
function logout(){mode=null;login()}
function head(title,sub){return `<header><div><h1>${title}</h1><p>${sub}</p></div><button class="btn secondary" onclick="logout()">Sair</button></header>`}

async function post(payload){
 const body=new URLSearchParams(payload);
 await fetch(API_URL,{method:"POST",body,mode:"no-cors"});
}
function addBook(e){
 e.preventDefault();
 const b={
  action:"add",
  password:"0402",
  titulo:v("titulo"),autor:v("autor"),genero:v("genero"),
  nota:v("nota"),mais:v("mais"),menos:v("menos"),porque:v("porque"),opiniao:v("opiniao")
 };
 const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Salvando...";
 post(b).then(()=>{alert("Livro salvo!");userPage()}).catch(()=>showError("Não foi possível enviar o livro. Verifique a conexão.")).finally(()=>{btn.disabled=false});
}
function v(id){return document.getElementById(id).value.trim()}

function userPage(){
 setBackground("her-bg");
 app.innerHTML=`<main class="shell">${head("Minha Biblioteca","Cadastre os livros que você já leu.")}
 <section class="card section"><h2>➕ Adicionar livro</h2>
 <form onsubmit="addBook(event)"><div class="formgrid">
 <div><label>Nome do livro *</label><input id="titulo" class="input" required></div>
 <div><label>Autor *</label><input id="autor" class="input" required></div>
 <div><label>Gênero *</label><input id="genero" class="input" placeholder="Romance, terror..." required></div>
 <div><label>Nota (0 a 10) *</label><input id="nota" class="input" type="number" min="0" max="10" step=".1" required></div>
 <div class="full"><label>❤️ Parte que mais gostou</label><textarea id="mais" class="input"></textarea></div>
 <div class="full"><label>💔 Parte que menos gostou</label><textarea id="menos" class="input"></textarea></div>
 <div class="full"><label>💭 Por que comprou esse livro?</label><textarea id="porque" class="input"></textarea></div>
 <div class="full"><label>📝 O que achou do livro no geral?</label><textarea id="opiniao" class="input"></textarea></div>
 </div><button class="btn primary" type="submit">Salvar livro</button></form></section>
 <section class="card section"><h2>📖 Seus livros</h2><p class="muted">Os livros já salvos ficam na planilha. Para consultar a biblioteca completa, use a área do painel.</p></section>
 </main>`;
}

function jsonp(params){
 return new Promise((resolve,reject)=>{
  const cb="cb_"+Date.now()+"_"+Math.random().toString(36).slice(2);
  const s=document.createElement("script");
  const q=new URLSearchParams({...params,callback:cb});
  window[cb]=data=>{cleanup();resolve(data)};
  s.onerror=()=>{cleanup();reject(new Error("Falha"))};
  function cleanup(){delete window[cb];s.remove()}
  s.src=API_URL+"?"+q.toString();
  document.body.appendChild(s);
 });
}
async function ownerPage(){
 setBackground("him-bg");
 app.innerHTML=`<main class="shell">${head("Painel da Biblioteca","Conheça os gostos literários dela.")}<div class="loading card section">Carregando dados...</div></main>`;
 try{
  const data=await jsonp({action:"list",password:"1510"});
  if(!data.ok) throw Error(data.error||"Erro");
  books=data.books||[]; renderOwner();
 }catch(e){app.innerHTML=`<main class="shell">${head("Painel da Biblioteca","Erro ao carregar.")}<section class="card section"><p>Não consegui acessar a planilha. Confira a URL do Apps Script e a publicação como aplicativo da Web.</p><button class="btn secondary" onclick="ownerPage()">Tentar novamente</button></section></main>`}
}
function renderOwner(){
 const n=books.length, avg=n?(books.reduce((a,b)=>a+Number(b.nota),0)/n).toFixed(1):"—";
 const counts={};books.forEach(b=>counts[b.genero]=(counts[b.genero]||0)+1);
 const genres=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
 const hi=n?[...books].sort((a,b)=>Number(b.nota)-Number(a.nota))[0]:null;
 const lo=n?[...books].sort((a,b)=>Number(a.nota)-Number(b.nota))[0]:null;
 app.innerHTML=`<main class="shell">${head("Painel da Biblioteca","Estatísticas calculadas diretamente da sua planilha.")}
 <section class="hero card"><div><h2>📚 Perfil literário</h2><p>Atualizado ao abrir o painel.</p></div></section>
 <section class="stats">
 <div class="card stat"><b>${n}</b><span>Livros</span></div>
 <div class="card stat"><b>${avg}</b><span>Nota média</span></div>
 <div class="card stat"><b>${esc(genres[0]?.[0]||"—")}</b><span>Gênero favorito</span></div>
 <div class="card stat"><b>${hi?hi.nota:"—"}</b><span>Maior nota</span></div>
 </section>
 <div class="grid">
 <section class="card section"><h2>🏆 Destaques</h2>${hi?`<h3>${esc(hi.titulo)}</h3><p>⭐ ${hi.nota}/10</p><p>${esc(hi.opiniao||"Sem opinião geral.")}</p><hr><p>Menor nota: <b>${esc(lo.titulo)}</b> — ⭐ ${lo.nota}/10</p>`:`<p class="muted">Nenhum livro cadastrado.</p>`}</section>
 <section class="card section"><h2>🏷️ Gêneros</h2>${genres.map(([g,c])=>`<div class="barrow"><div>${esc(g)} <span>${c}</span></div><i style="width:${c/n*100}%"></i></div>`).join("")||'<p class="muted">Sem dados.</p>'}</section>
 </div>
 <section class="card section"><h2>📖 Livros cadastrados</h2>${books.map(b=>`<article class="book"><div><h3>${esc(b.titulo)}</h3><small>${esc(b.autor)} • ${esc(b.genero)}</small><p>❤️ <b>Mais gostou:</b> ${esc(b.mais||"—")}</p><p>💔 <b>Menos gostou:</b> ${esc(b.menos||"—")}</p><p>💭 <b>Por que comprou:</b> ${esc(b.porque||"—")}</p><p>📝 <b>Opinião:</b> ${esc(b.opiniao||"—")}</p></div><strong>⭐ ${b.nota}</strong></article>`).join("")||'<p class="muted">Nenhum livro cadastrado.</p>'}</section>
 </main>`;
}
login();
