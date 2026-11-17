// MIT. Shared by the real injected UI and focused deterministic race regressions.
// A consumed proposal ID never authorizes another proposal, even after a stale refresh.
export function approvalOnce(consumed,id,buttons,action){
 for(const button of buttons)button.disabled=consumed.has(id);
 return async()=>{
  if(consumed.has(id))return;
  consumed.add(id);for(const button of buttons)button.disabled=true;
  try{return await action()}
  catch(error){consumed.delete(id);for(const button of buttons)button.disabled=false;throw error}
 };
}
