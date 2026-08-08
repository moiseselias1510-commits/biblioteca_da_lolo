/*
 * GOOGLE APPS SCRIPT — Nossa Biblioteca
 *
 * 1) Crie uma planilha Google Sheets.
 * 2) Na primeira aba, linha 1:
 *    ID | Data | Livro | Autor | Gênero | Nota | MaisGostou | MenosGostou | PorQueComprou | Opiniao
 * 3) Extensões > Apps Script > apague tudo e cole este código.
 * 4) Troque as senhas abaixo se quiser.
 * 5) Implantar > Nova implantação > Aplicativo da Web.
 *    Executar como: Eu · Quem tem acesso: Qualquer pessoa
 * 6) Copie a URL /exec para config.js.
 *
 * Ações:
 *   list   — listar livros  (USER_PASSWORD ou OWNER_PASSWORD)
 *   add    — adicionar      (USER_PASSWORD)
 *   update — editar         (USER_PASSWORD)
 *   delete — apagar         (USER_PASSWORD)
 */

const USER_PASSWORD  = "0402";
const OWNER_PASSWORD = "1510";

const HEADERS = [
  "ID","Data","Livro","Autor","Gênero","Nota",
  "MaisGostou","MenosGostou","PorQueComprou","Opiniao"
];

function sheet_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let s=ss.getSheets()[0];
  if(s.getLastRow()===0){
    s.appendRow(HEADERS);
  }else{
    const first=s.getRange(1,1,1,HEADERS.length).getValues()[0];
    const fixes=[];
    HEADERS.forEach((h,i)=>{ if(String(first[i]||"").trim()!==h) fixes.push([i,h]); });
    fixes.forEach(f=>s.getRange(1,f[0]+1).setValue(f[1]));
  }
  return s;
}

function rowToBook_(r){
  return {
    id:String(r[0]||""),
    data:r[1]?Utilities.formatDate(new Date(r[1]),Session.getScriptTimeZone(),"yyyy-MM-dd HH:mm"):"",
    titulo:String(r[2]||""),
    autor:String(r[3]||""),
    genero:String(r[4]||""),
    nota:Number(r[5]||0),
    mais:String(r[6]||""),
    menos:String(r[7]||""),
    porque:String(r[8]||""),
    opiniao:String(r[9]||"")
  };
}

function findRowById_(s,id){
  const values=s.getDataRange().getValues();
  for(let i=1;i<values.length;i++){
    if(String(values[i][0])===String(id)) return i+1;
  }
  return -1;
}

function list_(){
  const s=sheet_();
  const values=s.getDataRange().getValues();
  if(values.length<=1) return [];
  return values.slice(1)
    .filter(r=>r[0])
    .map(rowToBook_)
    .sort((a,b)=>(b.data||"").localeCompare(a.data||""));
}

function jsonOut_(obj, callback){
  const payload=JSON.stringify(obj);
  if(callback){
    return ContentService.createTextOutput(callback+"("+payload+");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  try{
    const p=e.parameter||{};
    const action=p.action;

    if(action==="add"){
      if(p.password!==USER_PASSWORD) return jsonOut_({ok:false,error:"Não autorizado."});
      if(!p.titulo || !p.autor || !p.genero || p.nota==null)
        return jsonOut_({ok:false,error:"Campos obrigatórios faltando."});
      const nota=Math.max(0,Math.min(10,Number(p.nota)));
      const s=sheet_();
      const id=Utilities.getUuid();
      s.appendRow([
        id,new Date(),
        String(p.titulo).trim(),
        String(p.autor).trim(),
        String(p.genero).trim(),
        nota,
        String(p.mais||""),
        String(p.menos||""),
        String(p.porque||""),
        String(p.opiniao||"")
      ]);
      return jsonOut_({ok:true,id:id});
    }

    if(action==="update"){
      if(p.password!==USER_PASSWORD) return jsonOut_({ok:false,error:"Não autorizado."});
      if(!p.id) return jsonOut_({ok:false,error:"ID ausente."});
      const s=sheet_();
      const row=findRowById_(s,p.id);
      if(row===-1) return jsonOut_({ok:false,error:"Livro não encontrado."});
      const nota=Math.max(0,Math.min(10,Number(p.nota)));
      s.getRange(row,3,1,8).setValues([[
        String(p.titulo||"").trim(),
        String(p.autor||"").trim(),
        String(p.genero||"").trim(),
        nota,
        String(p.mais||""),
        String(p.menos||""),
        String(p.porque||""),
        String(p.opiniao||"")
      ]]);
      return jsonOut_({ok:true});
    }

    if(action==="delete"){
      if(p.password!==USER_PASSWORD) return jsonOut_({ok:false,error:"Não autorizado."});
      if(!p.id) return jsonOut_({ok:false,error:"ID ausente."});
      const s=sheet_();
      const row=findRowById_(s,p.id);
      if(row===-1) return jsonOut_({ok:false,error:"Livro não encontrado."});
      s.deleteRow(row);
      return jsonOut_({ok:true});
    }

    return jsonOut_({ok:false,error:"Ação inválida."});
  }catch(err){
    return jsonOut_({ok:false,error:String(err)});
  }
}

function doGet(e){
  const p=e.parameter||{};
  const callback=p.callback;
  let result;
  try{
    if(p.action!=="list"){
      result={ok:false,error:"Ação inválida."};
    }else if(p.password!==USER_PASSWORD && p.password!==OWNER_PASSWORD){
      result={ok:false,error:"Não autorizado."};
    }else{
      result={ok:true,books:list_()};
    }
  }catch(err){
    result={ok:false,error:String(err)};
  }
  return jsonOut_(result,callback);
}
