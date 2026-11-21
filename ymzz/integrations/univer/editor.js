// MIT. Human-operated local sheet surface; no backend persistence or model authority.
import {createUniver,LocaleType,mergeLocales} from '@univerjs/presets';
import {UniverSheetsCorePreset} from '@univerjs/preset-sheets-core';
import zhTW from '@univerjs/preset-sheets-core/locales/zh-TW';
import '@univerjs/preset-sheets-core/lib/index.css';
import './editor.css';
import {MAX_BYTES,parseSnapshot} from './snapshot.mjs';
const $=id=>document.getElementById(id),status=$('status');
const scheme=new URLSearchParams(location.search).get('scheme')==='dark'?'dark':'light';document.documentElement.dataset.scheme=scheme;
try{
 const {univer,univerAPI}=createUniver({locale:LocaleType.ZH_TW,darkMode:scheme==='dark',locales:{[LocaleType.ZH_TW]:mergeLocales(zhTW)},presets:[UniverSheetsCorePreset({container:'sheet'})]});
 let current,listener,dirty=false;
 const mark=()=>{dirty=true;status.textContent='有未下載的編輯；重新整理會遺失，請下載 JSON 保存。'};
 const replace=snapshot=>{listener?.dispose();if(current)univerAPI.disposeUnit(current.getId());current=univerAPI.createWorkbook(snapshot);listener=current.onCommandExecuted(command=>{if(command.type===2)mark()});dirty=false;status.textContent='Univer 1.5.2 已載入；僅在此頁記憶體編輯，不會自動上傳或寫入工作區。';};
 replace({id:'ymzz-local-workbook',name:'本機試算表',appVersion:'1.5.2',locale:LocaleType.ZH_TW,sheetOrder:['sheet1'],sheets:{sheet1:{id:'sheet1',name:'工作表1',rowCount:200,columnCount:26,cellData:{}}}});
 $('new').onclick=()=>{if(!dirty||confirm('未下載的修改將遺失，要清空試算表嗎？'))replace({id:'ymzz-local-workbook',name:'本機試算表',appVersion:'1.5.2',locale:LocaleType.ZH_TW,sheetOrder:['sheet1'],sheets:{sheet1:{id:'sheet1',name:'工作表1',rowCount:200,columnCount:26,cellData:{}}}})};
 $('open').onchange=async()=>{const file=$('open').files?.[0];try{if(!file)return;if(file.size>MAX_BYTES)throw new Error('檔案超過 8 MiB');const snapshot=parseSnapshot(await file.text());if(dirty&&!confirm('未下載的修改將遺失，要開啟選定的 JSON 嗎？'))return;replace(snapshot)}catch(e){status.textContent='無法開啟：'+e.message}finally{$('open').value=''}};
 $('save').onclick=()=>{try{const text=JSON.stringify(current.save(),null,2)+'\n';parseSnapshot(text);const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='ymzz-univer-workbook.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);dirty=false;status.textContent='已交給瀏覽器下載；請確認下載完成。沒有同步、上傳或寫入專案。'}catch(e){status.textContent='無法匯出：'+e.message}};
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
 window.addEventListener('pagehide',()=>{listener?.dispose();univer.dispose()},{once:true});
}catch(e){status.textContent='試算表啟動失敗：'+e.message;status.setAttribute('role','alert')}
