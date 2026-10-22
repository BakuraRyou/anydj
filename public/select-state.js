// Rewriting a native select's state or option nodes can close its popup.
export function setControlDisabled(control,value){
 const disabled=Boolean(value);if(control.disabled!==disabled)control.disabled=disabled;
}
const opened=select=>{try{return select.matches(':open');}catch{return false;}};
export function setSelectValue(select,value){
 const next=String(value??'');if(select.value!==next&&!opened(select))select.value=next;
}
const states=new WeakMap();
export function syncSelectOptions(select,choices,value=select.value){
 const options=choices.map(o=>({value:String(o.value??''),label:String(o.label??''),disabled:Boolean(o.disabled),title:o.title||''}));
 const same=select.options.length===options.length&&options.every((o,i)=>{
  const current=select.options[i];return current.value===o.value&&current.textContent===o.label&&current.disabled===o.disabled&&current.title===o.title;
 });
 let state=states.get(select);
 if(!state){
  state={pending:null,scheduled:false};states.set(select,state);
  const flush=()=>{
   if(state.scheduled)return;state.scheduled=true;
   setTimeout(()=>{
    state.scheduled=false;const pending=state.pending;
    if(!pending||opened(select))return;
    // Preserve a user choice made after an older background snapshot.
    const chosen=select.value!==pending.original?select.value:pending.value;
    syncSelectOptions(select,pending.options,chosen);
   },0);
  };
  for(const event of ['change','blur','keyup','pointerup'])select.addEventListener?.(event,flush);
 }
 if(opened(select)){
  if(!same||select.value!==String(value??''))state.pending={options,value,original:state.pending?.original??select.value};
  return;
 }
 state.pending=null;
 if(!same)select.replaceChildren(...options.map(o=>{const option=new Option(o.label,o.value);option.disabled=o.disabled;option.title=o.title;return option;}));
 setSelectValue(select,value);
}
