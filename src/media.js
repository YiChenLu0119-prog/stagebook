/* Step attachments are local production assets, never network uploads. */
const STEP_MEDIA_MIMES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
let stepMediaBusy=false,stepMediaTarget=null;
const stepMediaURLs=new Map();
let embeddedStepMedia=null;
function fit720(width,height){
 const landscape=width>=height,scale=Math.min(1,(landscape?1280:720)/width,(landscape?720:1280)/height);
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
function embeddedStepMediaFile(key){
 if(rootDir||resources.size)return null;try{if(embeddedStepMedia===null)embeddedStepMedia=JSON.parse($('#embedded-media')?.textContent||'{}');const item=embeddedStepMedia[key];if(!item||!STEP_MEDIA_MIMES[item.type])return null;const bytes=Uint8Array.from(atob(item.base64),c=>c.charCodeAt(0));return new Blob([bytes],{type:item.type});}catch{return null;}
}
function stepMediaSection(cue){
 if(!cue)return '';return ui`<section class="step-media" data-step-media="${esc(cue.id)}"><div class="step-media-heading"><span>本步图片与视频</span>${!rehearsal?`<button data-action="media-add:${esc(cue.id)}">${tr('＋ 添加')}</button>`:''}</div><div class="step-media-items">${(cue.attachments||[]).map(a=>`<div class="step-media-item"><button class="media-open" data-action="media-open:${esc(cue.id)}:${esc(a.id)}"><span class="media-thumbnail" data-media-thumbnail="${esc(a.id)}">${a.type==='video'?'▶':'▧'}</span><span><b>${esc(a.name)}</b><small>${a.width} × ${a.height}${a.type==='video'?' · '+fmt(a.duration):''}</small></span></button>${!rehearsal?`<button class="media-remove" data-action="media-remove:${esc(cue.id)}:${esc(a.id)}" aria-label="${esc(tr('移除附件'))}">×</button>`:''}</div>`).join('')}</div>${!rehearsal?tr('<p class="footer-note">随演出包保存 · 自动压到 720p 以内 · 视频最长 2 分钟</p>'):''}</section>`;
}
async function hydrateStepMedia(){
 const identity=showId+'/'+songId;
 for(const cue of song()?.cues||[])for(const a of cue.attachments||[]){
  const node=$$('[data-media-thumbnail]').find(n=>n.dataset.mediaThumbnail===a.id);if(!node)continue;
  try{const file=await resourceFile(keyPath()+a.file);if(!file||identity!==showId+'/'+songId||!node.isConnected)continue;const cached=stepMediaURLs.get(a.id);let url=cached?.file===file?cached.url:null;
   if(!url){if(cached)URL.revokeObjectURL(cached.url);url=URL.createObjectURL(new Blob([file],{type:a.mimeType}));stepMediaURLs.set(a.id,{file,url});}
   node.innerHTML=a.type==='image'?`<img src="${esc(url)}" alt="" loading="lazy">`:'▶';
  }catch{}
 }
}
async function previewStepMedia(cueId,id){
 const cue=song().cues.find(c=>c.id===cueId),a=cue?.attachments?.find(a=>a.id===id);if(!a)return;
 const file=await resourceFile(keyPath()+a.file);if(!file){toast(tr('附件文件缺失，请重新导入完整演出包。'));return;}
 pause();const url=URL.createObjectURL(new Blob([file],{type:a.mimeType}));modal(a.name,`<div class="media-preview">${a.type==='video'?`<video src="${esc(url)}" controls playsinline preload="metadata"></video>`:`<img src="${esc(url)}" alt="${esc(a.name)}">`}</div>`);
 const closed=()=>{URL.revokeObjectURL(url);$('#dialog').removeEventListener('close',closed);};$('#dialog').addEventListener('close',closed);
}
function mediaCodec(){
 if(typeof MediaRecorder==='undefined')return null;
 return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))||null;
}
function canvasBlob(canvas,type='image/jpeg',quality=.82){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error(tr('图片处理失败。'))),type,quality));}
function loadMediaElement(element,file,job){
 const url=URL.createObjectURL(file);element.preload='auto';
 const ready=new Promise((resolve,reject)=>{let timer=setTimeout(()=>finish(Error(tr('媒体读取超时，请换一个文件。'))),20000);function finish(error){clearTimeout(timer);element.removeEventListener('error',failed);element.removeEventListener('loadedmetadata',loaded);element.removeEventListener('load',loaded);job?.cancelHooks.delete(cancel);error?reject(error):resolve();}const failed=()=>finish(Error(tr('无法读取这个图片或视频格式。'))),loaded=()=>finish(),cancel=()=>finish(Object.assign(Error(tr('已取消处理。')),{name:'AbortError'}));job?.cancelHooks.add(cancel);element.addEventListener('error',failed,{once:true});element.addEventListener(element.tagName==='IMG'?'load':'loadedmetadata',loaded,{once:true});element.src=url;});
 return {ready,url};
}
function mediaProgress(title){
 const job={cancelled:false,cancelHooks:new Set()};pause();modal(title,ui`<p id="mediaProgressText">正在读取文件…</p><progress id="mediaProgressBar" max="1" value="0"></progress><p class="footer-note">处理时请保持此页面可见。</p><button id="cancelMediaJob">取消</button>`);
 const cancel=()=>{job.cancelled=true;for(const hook of job.cancelHooks)hook();};$('#cancelMediaJob').onclick=cancel;$('#dialog').addEventListener('cancel',cancel);$('#dialog').addEventListener('close',cancel);
 job.report=(progress,label)=>{if($('#mediaProgressBar'))$('#mediaProgressBar').value=Math.min(1,Math.max(0,progress));if($('#mediaProgressText'))$('#mediaProgressText').textContent=label;};
 job.check=()=>{if(job.cancelled)throw Object.assign(Error(tr('已取消处理。')),{name:'AbortError'});};
 job.dispose=()=>{$('#dialog').removeEventListener('cancel',cancel);$('#dialog').removeEventListener('close',cancel);};return job;
}
async function playMediaForProcessing(element,job){
 try{await element.play();}catch(error){
  if(error.name!=='NotAllowedError')throw error;
  job.report(0,tr('浏览器需要你点击后开始处理。'));
  const button=document.createElement('button');button.textContent=tr('开始处理');button.className='gold';$('#dialogBody').append(button);
  await new Promise((resolve,reject)=>{const timer=setInterval(()=>{if(job.cancelled){clearInterval(timer);reject(Object.assign(Error(tr('已取消处理。')),{name:'AbortError'}));}},100);button.onclick=()=>element.play().then(()=>{clearInterval(timer);button.remove();resolve();},reject);});
 }
}
async function resumeMediaContext(context,job){
 const resume=context.resume();resume.catch(()=>{});await Promise.race([resume,new Promise(resolve=>setTimeout(resolve,350))]);if(context.state==='running')return;
 job.report(0,tr('浏览器需要你点击后开始处理。'));const button=document.createElement('button');button.textContent=tr('开始处理');button.className='gold';$('#dialogBody').append(button);
 await new Promise((resolve,reject)=>{const timer=setInterval(()=>{if(job.cancelled){clearInterval(timer);reject(Object.assign(Error(tr('已取消处理。')),{name:'AbortError'}));}},100);button.onclick=()=>context.resume().then(()=>{if(context.state==='running'){clearInterval(timer);button.remove();resolve();}},reject);});
}
async function probeVideoDuration(video){
 if(Number.isFinite(video.duration)&&video.duration>0)return video.duration;
 await new Promise((resolve,reject)=>{const events=['durationchange','timeupdate','seeked'],timer=setTimeout(()=>finish(Error(tr('无法确认视频时长，请换一个文件。'))),8000);const check=()=>{if(Number.isFinite(video.duration)&&video.duration>0)finish();};function finish(error){clearTimeout(timer);for(const event of events)video.removeEventListener(event,check);error?reject(error):resolve();}for(const event of events)video.addEventListener(event,check);try{video.currentTime=1e10;}catch(error){finish(error);}});
 const duration=video.duration;video.currentTime=0;return duration;
}
async function compressStepImage(file,job){
 const image=new Image(),loaded=loadMediaElement(image,file,job);
 try{await loaded.ready;job.check();if(!image.naturalWidth||!image.naturalHeight)throw Error(tr('图片尺寸无效。'));const size=fit720(image.naturalWidth,image.naturalHeight);if(!size.width||!size.height)throw Error(tr('图片尺寸无效。'));
  const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,size.width,size.height);ctx.drawImage(image,0,0,size.width,size.height);
  const blob=await canvasBlob(canvas);job.check();return {blob,...size,type:'image',mimeType:'image/jpeg'};
 }finally{URL.revokeObjectURL(loaded.url);}
}
function createCanvasRecorder(canvas,audioTrack=null){
 const mimeType=mediaCodec();if(!mimeType||!canvas.captureStream)throw Error(tr('此浏览器暂不支持视频生成，请使用新版 Chrome、Edge 或 Safari。'));
 const stream=canvas.captureStream(30);if(audioTrack)stream.addTrack(audioTrack);const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:2200000,audioBitsPerSecond:128000}),chunks=[];
 const done=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>reject(e.error||Error(tr('视频生成失败。')));recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType||mimeType}));});
 done.catch(()=>{});return {recorder,done,stream,mimeType,stop(){if(recorder.state!=='inactive')recorder.stop();},dispose(){stream.getTracks().forEach(t=>t.stop());}};
}
async function compressStepVideo(file,job){
 const video=document.createElement('video');video.playsInline=true;const loaded=loadMediaElement(video,file,job);let context,recording;
 try{
  await loaded.ready;job.check();const duration=await probeVideoDuration(video);
  if(!Number.isFinite(duration)||duration<=0)throw Error(tr('无法确认视频时长，请换一个文件。'));
  if(duration>120)throw Error(tr('备注视频不能超过 2 分钟，请先剪短后再添加。'));
  const fitted=fit720(video.videoWidth,video.videoHeight),size={width:Math.max(2,fitted.width-fitted.width%2),height:Math.max(2,fitted.height-fitted.height%2)},canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;const ctx=canvas.getContext('2d');
  let audioTrack;const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(AudioContext){context=new AudioContext();const destination=context.createMediaStreamDestination();context.createMediaElementSource(video).connect(destination);await resumeMediaContext(context,job);audioTrack=destination.stream.getAudioTracks()[0];}
  else throw Error(tr('此浏览器无法处理视频声音，请换用新版浏览器。'));
  recording=createCanvasRecorder(canvas,audioTrack);await playMediaForProcessing(video,job);ctx.drawImage(video,0,0,size.width,size.height);recording.recorder.start(1000);
  await new Promise((resolve,reject)=>{let frame=0,start=performance.now();const draw=()=>{try{job.check();if(video.error)throw Error(tr('视频解码中断。'));ctx.drawImage(video,0,0,size.width,size.height);job.report(video.currentTime/duration,ui`正在压缩视频：${fmt(video.currentTime)} / ${fmt(duration)}`);if(video.ended||video.currentTime>=duration-.015){resolve();return;}if(performance.now()-start>(duration+30)*1000)throw Error(tr('视频处理停滞，请保持页面可见后重试。'));frame=requestAnimationFrame(draw);}catch(error){cancelAnimationFrame(frame);reject(error);}};draw();});
  video.pause();recording.stop();const blob=await recording.done;job.check();if(!blob.size)throw Error(tr('视频生成失败。'));return {blob,...size,type:'video',duration,mimeType:blob.type.split(';')[0]};
 }finally{video.pause();video.removeAttribute('src');video.load();recording?.stop();recording?.dispose();await context?.close();URL.revokeObjectURL(loaded.url);}
}
async function importStepMedia(file,target){
 if(stepMediaBusy||!file||!target)return;const s=show(),q=song(),cue=q.cues.find(c=>c.id===target);if(!cue)return;
 stepMediaBusy=true;const job=mediaProgress(tr('添加本步素材'));
 try{
  const video=file.type.startsWith('video/')||/\.(mp4|mov|webm|m4v)$/i.test(file.name),image=file.type.startsWith('image/')||/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);if(!video&&!image)throw Error(tr('请选择图片或视频文件。'));
  const result=await (video?compressStepVideo(file,job):compressStepImage(file,job));job.check();
  if(!lib.shows.includes(s)||!s.songs.includes(q)||!q.cues.includes(cue))throw Error(tr('这一步已变化，请重新选择后添加。'));
  const id=C.id('media'),ext=STEP_MEDIA_MIMES[result.mimeType];if(!ext)throw Error(tr('视频生成格式不受支持。'));const path=`assets/${id}.${ext}`,attachment={id,name:file.name,type:result.type,file:path,mimeType:result.mimeType,width:result.width,height:result.height,bytes:result.blob.size,...(video?{duration:result.duration}:{})};
  mutate(()=>{cue.attachments||=[];cue.attachments.push(attachment);pendingAssets.set(`shows/${s.id}/songs/${q.id}/${path}`,result.blob);},false);job.dispose();closeModal();renderInspector();toast(tr('素材已添加；保存演出包时会一起带走。'));
 }catch(error){if(error.name!=='AbortError')toast(error.message);job.dispose();closeModal();}finally{job.dispose();stepMediaBusy=false;}
}
async function stepMediaAction(a){
 if(a.startsWith('media-add:')){if(canEdit()){stepMediaTarget=a.slice(10);$('#stepMediaInput').click();}return true;}
 if(a.startsWith('media-open:')){const [cue,id]=a.slice(11).split(':');await previewStepMedia(cue,id);return true;}
 if(a.startsWith('media-remove:')){if(canEdit()){const [cueId,id]=a.slice(13).split(':'),cue=song().cues.find(c=>c.id===cueId);if(cue)mutate(()=>cue.attachments=(cue.attachments||[]).filter(a=>a.id!==id));}return true;}return false;
}
$('#stepMediaInput').addEventListener('change',e=>{const file=e.target.files?.[0],target=stepMediaTarget;e.target.value='';importStepMedia(file,target);});
async function mediaContentHash(file){const bytes=new Uint8Array(await file.arrayBuffer());if(globalThis.crypto?.subtle)return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');let a=2166136261,b=5381;for(const n of bytes){a=Math.imul(a^n,16777619);b=Math.imul(b,33)^n;}return (a>>>0).toString(16)+(b>>>0).toString(16)+'-'+bytes.length;}
