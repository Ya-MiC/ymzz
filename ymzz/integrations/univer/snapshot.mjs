// MIT. Deliberately narrow local JSON interchange, not Excel/XLSX import.
export const MAX_BYTES=8*1024*1024;
const ensure=(ok)=>{if(!ok)throw new Error('UNIVER_SNAPSHOT_REJECTED')};
export function parseSnapshot(text){
 ensure(typeof text==='string'&&new TextEncoder().encode(text).length<=MAX_BYTES);
 const value=JSON.parse(text);let nodes=0;
 function visit(v,depth=0){ensure(++nodes<=250000&&depth<=24);if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){ensure(!['__proto__','prototype','constructor'].includes(k));visit(x,depth+1)}}visit(value);
 ensure(value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.id==='string'&&value.id.length<=120&&typeof value.name==='string'&&value.name.length<=200);
 ensure(value.sheets&&typeof value.sheets==='object'&&!Array.isArray(value.sheets)&&Array.isArray(value.sheetOrder));
 const keys=Object.keys(value.sheets);ensure(keys.length>=1&&keys.length<=16&&value.sheetOrder.length===keys.length&&new Set(value.sheetOrder).size===keys.length&&value.sheetOrder.every(k=>keys.includes(k)));
 let cells=0;
 for(const [id,s]of Object.entries(value.sheets)){
  ensure(s&&s.id===id&&typeof s.name==='string'&&s.name.length<=200&&Number.isSafeInteger(s.rowCount)&&s.rowCount>=1&&s.rowCount<=10000&&Number.isSafeInteger(s.columnCount)&&s.columnCount>=1&&s.columnCount<=256);
  ensure(s.cellData&&typeof s.cellData==='object'&&!Array.isArray(s.cellData));
  for(const [r,row]of Object.entries(s.cellData)){
   ensure(/^(0|[1-9][0-9]*)$/.test(r)&&Number(r)<s.rowCount&&row&&typeof row==='object'&&!Array.isArray(row));
   for(const [c,cell]of Object.entries(row)){ensure(/^(0|[1-9][0-9]*)$/.test(c)&&Number(c)<s.columnCount&&++cells<=50000&&cell&&typeof cell==='object');if(cell.f!==undefined)ensure(typeof cell.f==='string'&&cell.f.length<=8192);if(cell.v!==undefined)ensure(['string','number','boolean'].includes(typeof cell.v)||cell.v===null)}
  }
 }
 return value;
}
