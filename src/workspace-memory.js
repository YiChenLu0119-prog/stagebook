/* Last-used positions belong to this browser, never to the production. */
const songMemoryStorage='stagebook-song-workspace-v1';
let songMemory=new Map(),songMemoryStorageBlocked=false,songVisitKey='',songVisitRole='',songResumeOffer=null;

function songWorkspaceOptions(){return typeof operationPrefs==='undefined'?{}:operationPrefs;}
function songMemoryIdentity(){return song()?JSON.stringify([showId,songId]):'';}
function readSongMemory(){
 if(songMemoryStorageBlocked)return songMemory;
 try{
  const rows=JSON.parse(localStorage.getItem(songMemoryStorage)||'[]');
  if(Array.isArray(rows)){
   songMemory=new Map(rows.filter(row=>Array.isArray(row)&&typeof row[0]==='string'&&Number.isFinite(row[1]?.at)&&row[1].at>=0&&row[1].at<=86400&&typeof row[1].actor==='string'));
  }
 }catch(e){songMemoryStorageBlocked=true;}
 return songMemory;
}
function saveSongVisit(){
 const key=songMemoryIdentity();
 if(!key||key!==songVisitKey||songWorkspaceOptions().rememberSong===false)return;
 const actor=song().castIds.includes(focusActor)?focusActor:'';
 const untouched=current<=.05&&songResumeOffer?.key===key;
 if(untouched&&actor===songVisitRole)return;
 const at=untouched?songResumeOffer.at:Math.max(0,Math.min(86400,Math.round(current*10)/10));
 const memory=readSongMemory();
 memory.delete(key);
 memory.set(key,{at,actor});
 if(memory.size>120)memory.delete(memory.keys().next().value);
 if(!songMemoryStorageBlocked)try{localStorage.setItem(songMemoryStorage,JSON.stringify([...memory]));}catch(e){songMemoryStorageBlocked=true;}
}
function beginSongVisit(previousActor=''){
 const cast=song()?.castIds||[],prefs=songWorkspaceOptions();
 focusActor=prefs.keepActor!==false&&cast.includes(previousActor)?previousActor:cast[0]||'';
 songVisitRole=focusActor;
 songVisitKey=songMemoryIdentity();
 const bookmark=prefs.rememberSong!==false&&readSongMemory().get(songVisitKey);
 const savedActor=cast.includes(bookmark?.actor)?bookmark.actor:'';
 songResumeOffer=bookmark&&(bookmark.at>.05||savedActor&&savedActor!==focusActor)?{key:songVisitKey,at:bookmark.at,actor:savedActor}:null;
}
function renderSongResume(){
 const panel=$('#songResume');
 if(songResumeOffer&&(songResumeOffer.key!==songMemoryIdentity()||current>.05||playing))songResumeOffer=null;
 const offer=songResumeOffer;
 const visible=Boolean(offer&&songWorkspaceOptions().rememberSong!==false&&!singing&&!songVideoOpen&&!reminderOpen);
 panel.hidden=!visible;
 if(!visible)return;
 const actor=offer.actor&&song().castIds.includes(offer.actor)?entity(offer.actor):null;
 const stamp=fmt(offer.at);
 $('#songResumeContinue').textContent=actor?ui`继续 ${stamp} · ${displayName(actor)}`:ui`继续 ${stamp}`;
 $('#songResumeReset').textContent=tr('从头开始');
 panel.setAttribute('aria-label',tr('恢复这首曲目的排练位置'));
}
function chooseSongResume(resume){
 const offer=songResumeOffer;
 if(!offer||offer.key!==songMemoryIdentity()||songWorkspaceOptions().rememberSong===false)return;
 songResumeOffer=null;
 if(resume&&song().castIds.includes(offer.actor))focusActor=offer.actor;
 pause();singleStepEnd=null;
 seek(resume?Math.min(offer.at,time()):0);
 saveSongVisit();
 renderAll();$('#currentTime').focus({preventScroll:true});
}
$('#songResumeContinue').addEventListener('click',()=>chooseSongResume(true));
$('#songResumeReset').addEventListener('click',()=>chooseSongResume(false));
window.addEventListener?.('pagehide',saveSongVisit);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveSongVisit();});
