/* Audio loading is transactional: stale loads and failed replacements cannot change the song. */
let audioState='none',audioError='',audioLoadGeneration=0,audioPlayGeneration=0,audioImportGeneration=0;
let audioClockCheckpoint=null;
let embeddedAssetData=null;
const embeddedAssetBlobs=new Map();
function embeddedAudioFile(key){
 if(rootDir||resources.size)return null;
 if(embeddedAssetBlobs.has(key))return embeddedAssetBlobs.get(key);
 try{
  if(embeddedAssetData===null)embeddedAssetData=JSON.parse($('#embedded-audio')?.textContent||'{}');
  const encoded=embeddedAssetData[key];if(typeof encoded!=='string')return null;
  const binary=atob(encoded),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const file=new Blob([bytes],{type:'audio/mpeg'});embeddedAssetBlobs.set(key,file);return file;
 }catch{return null;}
}
let audioPendingLoad=null,audioImportCancel=null,audioReady=Promise.resolve(false),audioSilentMode=false,audioImportBusy=false;
function audioPlayable(){return audioState==='ready'&&!!audio.src;}
function mediaProbe(player,url){
 let done=false,resolve,timer;const promise=new Promise(r=>resolve=r);
 const finish=result=>{if(done)return;done=true;clearTimeout(timer);player.removeEventListener('loadedmetadata',ready);player.removeEventListener('durationchange',ready);player.removeEventListener('loadeddata',ready);player.removeEventListener('canplay',ready);player.removeEventListener('error',failed);resolve(result);};
 const ready=()=>{if(player.readyState>=3&&Number.isFinite(player.duration)&&player.duration>0)finish({ok:true,duration:player.duration});};
 const failed=()=>finish({ok:false,error:tr('音乐无法读取或格式不受支持，请重新连接 MP3。')});
 player.addEventListener('loadedmetadata',ready);player.addEventListener('durationchange',ready);player.addEventListener('loadeddata',ready);player.addEventListener('canplay',ready);player.addEventListener('error',failed);
 return{promise,cancel:()=>finish({ok:false,cancelled:true}),start(){timer=setTimeout(()=>finish({ok:false,error:tr('音乐读取超时，请点重试或重新连接文件。')}),15000);player.preload='auto';try{player.src=url;player.load();ready();}catch{failed();}}};
}
function startAudioPlayback(player){
 let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(tr('音频启动超时')),{name:'TimeoutError'})),8000);});
 return Promise.race([Promise.resolve(player.play()),timeout]).finally(()=>clearTimeout(timer));
}
function beginAudioProgress(player){audioClockCheckpoint={player,value:player.currentTime,at:performance.now()};}
function checkAudioProgress(now){
 if(!audioPlayable()||audioSilentMode||current>=audioDuration)return true;const point=audioClockCheckpoint;
 if(!point||point.player!==audio||Math.abs(audio.currentTime-point.value)>.04){audioClockCheckpoint={player:audio,value:audio.currentTime,at:now};return true;}
 if(now-point.at<5000)return true;pause();audioState='error';audioError=tr('音乐没有真正开始播放，请点「连接音乐」重新选择包内的 MP3。');updateTransport();return false;
}
function releaseAudio(){
 audioClockCheckpoint=null;
 audioPendingLoad?.cancel();audioPendingLoad=null;audio.pause();if(audio._stagebookError)audio.removeEventListener('error',audio._stagebookError);audio.removeAttribute('src');audio.load();
 if(audioURL)URL.revokeObjectURL(audioURL);audioURL=null;audioDuration=0;
}
function bindActiveAudio(player,generation){
 const failed=()=>{if(generation!==audioLoadGeneration||player!==audio||audioState!=='ready')return;pause();audioState='error';audioError=tr('音乐播放中断，请重新连接文件或静音走台。');updateTransport();};
 player._stagebookError=failed;player.addEventListener('error',failed);player.playbackRate=rate;
}
function embeddedAudioSource(key){
 if(resources.size)return null;const embedded=$('#embedded-library');if(!embedded)return null;
 try{const data=JSON.parse(embedded.textContent),s=data.shows.find(s=>s.id===showId),q=s?.songs.find(q=>q.id===songId);if(!q?.audio||`shows/${s.id}/songs/${q.id}/${q.audio.file}`!==key)return null;
  const prefix=embedded.getAttribute('data-library-root')||'',relative=prefix+key;if(!C.safePath(relative))return null;
  return new URL(relative.split('/').map(encodeURIComponent).join('/'),document.baseURI).href;
 }catch{return null;}
}
async function loadAudio(){
 const generation=++audioLoadGeneration,identity=song();audioPlayGeneration++;audioSilentMode=false;
 if(audioImportCancel){audioImportGeneration++;audioImportCancel();audioImportCancel=null;audioImportBusy=false;}
 releaseAudio();audio=new Audio();audioError='';audioState=identity?.audio?'loading':'none';updateTransport();
 if(!identity?.audio){audioReady=Promise.resolve(false);return false;}
 const operation=(async()=>{
  try{const key=keyPath()+identity.audio.file,file=await resourceFile(key);if(generation!==audioLoadGeneration||identity!==song())return false;
   const url=file?URL.createObjectURL(file):embeddedAudioSource(key);if(!url){audioState='missing';audioError=tr('这首曲目的音乐尚未连接，请选择原 MP3 或导入完整演出包。');updateTransport();return false;}
   if(file)audioURL=url;const player=audio,probe=mediaProbe(player,url);audioPendingLoad=probe;probe.start();const result=await probe.promise;
   if(generation!==audioLoadGeneration||identity!==song()||result.cancelled)return false;audioPendingLoad=null;
   if(!result.ok){audioState='error';audioError=result.error;player.removeAttribute('src');player.load();updateTransport();return false;}
   audioDuration=result.duration;audioState='ready';bindActiveAudio(player,generation);try{player.currentTime=Math.min(current,audioDuration);}catch{}updateTransport();renderBottom();return true;
  }catch(error){if(generation!==audioLoadGeneration||identity!==song())return false;audioState='error';audioError=tr('无法读取音乐文件，请重新连接。');updateTransport();return false;}
 })();audioReady=operation;return operation;
}
async function importAudio(file){
 if(!file)return false;
 if(!/\.mp3$/i.test(file.name)||!file.size){toast(!file.size?tr('这个音乐文件是空的，请重新选择。'):tr('请选择 MP3 音乐文件。'));return false;}
 pause();audioImportCancel?.();const generation=++audioImportGeneration,identity=song(),s=show(),url=URL.createObjectURL(file),candidate=new Audio(),probe=mediaProbe(candidate,url);let adopted=false;
 audioImportCancel=probe.cancel;audioImportBusy=true;updateTransport();probe.start();
 try{const result=await probe.promise;if(generation!==audioImportGeneration||identity!==song()||s!==show()||result.cancelled)return false;
  if(!result.ok){toast(result.error+tr(' 原来的音乐已保留。'));return false;}
  const relative='assets/'+C.id('music')+'.mp3',key=`shows/${s.id}/songs/${identity.id}/${relative}`;
  mutate(()=>{pendingAssets.set(key,file);identity.audio={file:relative,originalName:file.name};if(identity.mode==='steps'&&!identity.cues.length)identity.mode='timed';},false);
  const activeGeneration=++audioLoadGeneration;audioPlayGeneration++;releaseAudio();audio=candidate;audioURL=url;audioDuration=result.duration;audioState='ready';audioError='';audioSilentMode=false;audioReady=Promise.resolve(true);audioPendingLoad=null;adopted=true;bindActiveAudio(audio,activeGeneration);
  try{audio.currentTime=Math.min(current,audioDuration);}catch{}renderAll();toast(tr('音乐已连接：')+file.name);saveDraft();return true;
 }finally{if(!adopted){candidate.pause();candidate.removeAttribute('src');candidate.load();URL.revokeObjectURL(url);}if(generation===audioImportGeneration){audioImportCancel=null;audioImportBusy=false;updateTransport();}}
}
function renderAudioStatus(){
 const ready=audioPlayable(),failed=['missing','error'].includes(audioState),loading=audioState==='loading',name=song()?.audio?.originalName||tr('音乐');
 $('#audioButton').textContent=audioImportBusy?tr('检查音乐中…'):loading?tr('音乐读取中…'):ready?tr('更换音乐'):song()?.audio?tr('连接音乐'):tr('导入音乐');$('#audioButton').disabled=audioImportBusy;$('#audioButton').title=name;
 $('#audioButton').classList.toggle('warning',failed);$('#audioStatus').classList.toggle('warning',failed);$('#audioStatus').textContent=audioImportBusy?tr('正在检查新音乐'):loading?tr('音乐读取中'):ready?(audioSilentMode&&playing?tr('静音走台'):tr('♫ 音乐已就绪')):song()?.audio?tr('音乐未连接'):tr('无音乐');
 $('#audioFeedback').classList.toggle('hidden',!failed&&!loading);$('#audioFeedbackText').textContent=loading?tr('正在读取音乐，完成后即可播放。'):audioError;
 $('#audioRetry').classList.toggle('hidden',!failed);$('#audioConnect').classList.toggle('hidden',!failed);$('#audioSilent').classList.toggle('hidden',!failed);
}
async function audioAction(a){
 if(a==='audio-retry'){pause();await loadAudio();return true;}
 if(a==='audio-silent'){pause();singleStepEnd=null;await play(true,true);return true;}
 return false;
}
$('#audioInput').onchange=async e=>{try{await importAudio(e.target.files?.[0]);}catch(error){toast(tr('音乐接入未完成，请重新选择。'));}finally{e.target.value='';}};
