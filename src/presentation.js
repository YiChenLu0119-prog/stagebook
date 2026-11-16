/* Apply the window layout immediately, then promote it to native fullscreen if available. */
function createViewportPresentation(element,className,focusTarget,onChange){
 let mode='',generation=0,previousFocus=null,inertNodes=[];
 const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
 const active=()=>!!mode;
 function setMode(next){
  if(next===mode)return;
  const wasActive=active();
  mode=next;
  if(active()!==wasActive){
   element.classList.toggle(className,active());
   if(active()){
    previousFocus=document.activeElement;
    for(let current=element;current&&current!==document.body;){
     const parent=current.parentElement;
     if(!parent||parent===current)break;
     for(const sibling of parent.children||[]){
      if(sibling===current||sibling.id==='dialog'||sibling.id==='toast')continue;
      inertNodes.push([sibling,sibling.inert]);sibling.inert=true;
     }
     current=parent;
    }
    focusTarget()?.focus({preventScroll:true});
   }else{
    for(const [node,value] of inertNodes)node.inert=value;
    inertNodes=[];
    (previousFocus?.isConnected===false?focusTarget():previousFocus)?.focus({preventScroll:true});
    previousFocus=null;
   }
  }
  onChange?.();
 }
 async function exit(){
  generation++;
  if(fullscreenElement()===element){
   try{await (document.exitFullscreen||document.webkitExitFullscreen)?.call(document);}
   catch{toast(tr('请按 Esc 退出全屏。'));return;}
  }
  setMode('');
 }
 async function toggle(){
  if(active())return exit();
  closeWorkspaceMenus();closeContextMenu(false);
  const requestId=++generation;
  setMode('window');
  try{
   await (element.requestFullscreen||element.webkitRequestFullscreen)?.call(element);
   if(fullscreenElement()!==element)return;
   if(requestId===generation)setMode('native');
   else if(!active())await (document.exitFullscreen||document.webkitExitFullscreen)?.call(document);
  }catch{/* The window-filling layout stays active when native fullscreen is unavailable. */}
 }
 for(const eventName of ['fullscreenchange','webkitfullscreenchange']){
  document.addEventListener(eventName,()=>{
   if(fullscreenElement()===element&&active())setMode('native');
   else if(mode==='native'){generation++;setMode('');}
  });
 }
 return {active,toggle,exit};
}
