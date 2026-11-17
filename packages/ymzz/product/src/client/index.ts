// MIT. Native DSH slot/theme extension: no replacement shell or moved panels.
import { createElement as h } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
const g=globalThis as typeof globalThis & {
  __YMZZ_DSH_BRAND__?:string
  __YMZZ_NATIVE_SLOT_READY__?:boolean
  __YMZZ_SET_THEME__?:(id:string)=>void
}
export const inject=['slots','theme']
const palettes=[['cloud-light','雲箋淺','light','cloud'],['cloud-dark','雲箋暗','dark','cloud'],['earth-light','陶土淺','light','earth'],['earth-dark','陶土暗','dark','wood']] as const
export function apply(ctx:Context):void{
  const Mark=()=>h('img',{ src:g.__YMZZ_DSH_BRAND__,alt:'湛箴_ymzz',width:24,height:24,style:{ objectFit:'contain' } })
  const Name=()=>h('span',null,'湛箴_ymzz')
  const Tools=()=>h('button',{ type:'button','aria-label':'湛箴_ymzz 插件與驗證閘',onClick:()=>g.dispatchEvent(new Event('ymzz-open-plugin')),style:{ minHeight:44,minWidth:44 } },'湛箴_ymzz 插件')
  ctx.slots.inject('sidebar.brand.mark',()=>ctx.slots.inject('sidebar.brand.name',function*(){yield ctx.slots.register({ name:'sidebar.brand.mark' },Mark);yield ctx.slots.register({ name:'sidebar.brand.name' },Name)}))
  ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({ name:'sidebar.footer.action',id:'ymzz-reviewed-tools' },Tools))
  for(const [,id,colorScheme] of palettes)ctx.effect(()=>ctx.theme.register({ id,colorScheme,tokens:{ '--dsw-alias-bg-base':'var(--bg-0)','--dsw-alias-label-primary':'var(--ink-1)','--dsw-alias-brand-primary':'var(--accent)','--dsw-specific-sidebar-fill':'var(--bg-0)' } }),'ymzz: native Wenrun theme '+id)
  const adopt=()=>{const current=ctx.theme.getTheme();const p=palettes.find(p=>p[1]===current.active.id);if(p){document.documentElement.dataset.theme=p[2];document.documentElement.dataset.palette=p[3];localStorage.setItem('ymzz-dsh-wenrun',p[0])}}
  ctx.on('theme/change',adopt);adopt()
  ctx.effect(()=>{g.__YMZZ_SET_THEME__=(id)=>{const p=palettes.find(p=>p[0]===id);if(p)ctx.theme.setTheme(p[1])};const preference=localStorage.getItem('ymzz-dsh-wenrun')||'cloud-light';g.__YMZZ_SET_THEME__(preference);g.__YMZZ_NATIVE_SLOT_READY__=true;g.dispatchEvent(new Event('ymzz-native-slot-ready'));return()=>{delete g.__YMZZ_SET_THEME__;g.__YMZZ_NATIVE_SLOT_READY__=false;g.dispatchEvent(new Event('ymzz-native-slot-ready'))}},'ymzz: native slot lifecycle')
}
