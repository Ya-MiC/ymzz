// MIT. Explicitly opted-in loopback OpenAI-compatible transport. Not a model or OS sandbox.
import {assert} from './guard.mjs';
import {noSecrets} from './workspace.mjs';
export function validateEndpoint(value){
 assert(typeof value==='string'&&value.length<=256,'LOCAL_ENDPOINT_REQUIRED');
 let u;try{u=new URL(value)}catch{throw new Error('LOCAL_ENDPOINT_INVALID')}
 assert(u.protocol==='http:'&&['127.0.0.1','[::1]'].includes(u.hostname)&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/v1'&&u.port,'LOOPBACK_V1_ONLY');
 return u.href.replace(/\/$/,'');
}
export function providerConfig(input){
 assert(input&&input.consent===true&&typeof input.enabled==='boolean','PROVIDER_CONSENT_REQUIRED');
 if(!input.enabled)return {enabled:false};
 assert(typeof input.model==='string'&&/^[A-Za-z0-9_.:/-]{1,160}$/.test(input.model),'MODEL_ID_INVALID');
 return {enabled:true,endpoint:validateEndpoint(input.endpoint),model:input.model};
}
export function projectMessages(messages){
 return messages.map(m=>{
  assert(['system','developer','user','assistant','tool'].includes(m.role),'PROVIDER_ROLE_UNSUPPORTED');
  const content=m.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');noSecrets(content);
  const calls=m.content.filter(b=>b.type==='tool-call');
  const out={role:m.role==='developer'?'system':m.role,content:content||null};
  if(m.role==='tool'){assert(typeof m.toolCallId==='string','PROVIDER_TOOL_ID_REQUIRED');out.tool_call_id=m.toolCallId;out.content=content}
  if(calls.length)out.tool_calls=calls.map(b=>({id:b.id,type:'function',function:{name:b.name,arguments:b.arguments}}));
  return out;
 });
}
export async function requestCompletion(config,options,{fetcher=fetch}={}){
 assert(config?.enabled,'NO_LOCAL_PROVIDER_CONFIGURED');const endpoint=validateEndpoint(config.endpoint);
 const body=JSON.stringify({model:config.model,stream:false,max_tokens:Math.min(options.maxTokens||2048,4096),messages:projectMessages(options.messages),tools:(options.tools||[]).map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.parameters}}))});
 assert(Buffer.byteLength(body)<=262144,'PROVIDER_REQUEST_TOO_LARGE');noSecrets(body);
 let response;try{response=await fetcher(endpoint+'/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(20000),...(options.signal?[options.signal]:[])]),headers:{'content-type':'application/json'},body})}catch{throw new Error('LOCAL_PROVIDER_CONNECTION_FAILED')}
 assert(response.ok,'LOCAL_PROVIDER_HTTP_ERROR');assert(response.body,'PROVIDER_RESPONSE_INVALID');let text='',bytes=0;const decoder=new TextDecoder('utf-8',{fatal:true});
 for await(const chunk of response.body){bytes+=chunk.length;if(bytes>131072){await response.body.cancel?.().catch(()=>{});throw new Error('PROVIDER_RESPONSE_TOO_LARGE')}text+=decoder.decode(chunk,{stream:true})}
 text+=decoder.decode();let result;try{result=JSON.parse(text)}catch{throw new Error('PROVIDER_RESPONSE_INVALID')}
 const message=result.choices?.[0]?.message;assert(message&&Array.isArray(message.tool_calls||[])&&(message.tool_calls||[]).length<=1,'PROVIDER_RESPONSE_INVALID');
 assert(message.content==null||typeof message.content==='string','PROVIDER_RESPONSE_INVALID');noSecrets(message.content||'');
 for(const call of message.tool_calls||[]){assert(typeof call.id==='string'&&call.id.length<=128&&/^ymzz_(read|list|write|patch|test)$/.test(call.function?.name)&&typeof call.function.arguments==='string'&&Buffer.byteLength(call.function.arguments)<=32768,'PROVIDER_TOOL_INVALID');noSecrets(call.function.arguments);try{JSON.parse(call.function.arguments)}catch{throw new Error('PROVIDER_TOOL_ARGUMENTS_INVALID')}}
 return message;
}
export async function* completionChunks(message){
 let index=0;
 if(message.content){yield {type:'block-start',index,blockType:'text'};yield {type:'text-delta',index,text:message.content};yield {type:'block-end',index,block:{type:'text',text:message.content}};index++}
 for(const call of message.tool_calls||[]){const {id}=call,{name,arguments:args}=call.function;yield {type:'block-start',index,blockType:'tool-call'};yield {type:'tool-call-delta',index,id,name,argumentsDelta:args};yield {type:'block-end',index,block:{type:'tool-call',id,name,arguments:args}};index++}
 yield {type:'finish',reason:{kind:message.tool_calls?.length?'tool-calls':'stop'}};
}
