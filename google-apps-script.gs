/*
 * GOOGLE APPS SCRIPT — Nossa Biblioteca
 *
 * 1) Crie uma planilha Google Sheets.
 * 2) Na primeira aba, coloque na linha 1:
 *    ID | Data | Livro | Autor | Gênero | Nota | MaisGostou | MenosGostou | PorQueComprou | Opiniao
 * 3) Extensões > Apps Script.
 * 4) Apague o código existente e cole este.
 * 5) Troque as duas senhas abaixo.
 * 6) Implantar > Nova implantação > Aplicativo da Web.
 *    Executar como: Eu
 *    Quem tem acesso: Qualquer pessoa
 * 7) Copie a URL /exec para config.js.
 *
 * Observação: a senha é validada no servidor. Ainda assim, o endereço da
 * implantação deve ser tratado como privado e a planilha não deve ser pública.
 */

const USER_PASSWORD = "0402";
const OWNER_PASSWORD = "1510";

function sheet_(){
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function doPost(e){
  try{
    const p=e.parameter||{};
    if(p.action!=="add") return out_({ok:false,error:"Ação inválida."});
    if(p.password!==USER_PASSWORD) return out_({ok:false,error:"Não autorizado."});

    const s=sheet_();
    const id=Utilities.getUuid();
    s.appendRow([
      id,new Date(),p.titulo||"",p.autor||"",p.genero||"",
      Number(p.nota||0),p.mais||"",p.menos||"",p.porque||"",p.opiniao||""
    ]);
    return out_({ok:true});
  }catch(err){
    return out_({ok:false,error:String(err)});
  }
}

function doGet(e){
  const p=e.parameter||{};
  const callback=p.callback;
  let result;
  try{
    if(p.action!=="list") result={ok:false,error:"Ação inválida."};
    else if(p.password!==OWNER_PASSWORD) result={ok:false,error:"Não autorizado."};
    else result={ok:true,books:list_()};
  }catch(err){result={ok:false,error:String(err)}}

  const json=JSON.stringify(result);
  if(callback) return ContentService.createTextOutput(callback+"("+json+");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function list_(){
  const s=sheet_(), values=s.getDataRange().getValues();
  if(values.length<=1)return [];
  return values.slice(1).filter(r=>r[0]).map(r=>({
    id:String(r[0]),data:r[1],titulo:String(r[2]||""),autor:String(r[3]||""),
    genero:String(r[4]||""),nota:Number(r[5]||0),mais:String(r[6]||""),
    menos:String(r[7]||""),porque:String(r[8]||""),opiniao:String(r[9]||"")
  }));
}

function out_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
