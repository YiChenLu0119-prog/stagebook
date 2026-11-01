/* Local, real-time stage recording. The 120-second note limit never applies here. */
let videoExporting=false;
function videoExportDialog(){
 if(videoExporting||stepMediaBusy)return;
 modal(tr('导出排练视频'),ui`<p>录制舞台画面，最高 720p；底部显示当前歌词与下一句，不包含编辑面板。按正常速度生成，需要约等于曲目时长的时间。</p><div class="video-song-list">${show().songs.map(q=>`<label class="smallcheck"><input type="checkbox" data-video-song="${esc(q.id)}" ${q.id===songId?'checked':''}><span>${esc(q.title)}<small>${q.audio?' ♫':tr(' · 无音乐')}</small></span></label>`).join('')}</div><label class="smallcheck"><input id="videoWithAudio" type="checkbox" checked>包含已连接的音乐</label><label class="field"><span>多首曲目的处理</span><select id="videoGrouping"><option value="combined">按演出顺序合成一个视频</option><option value="separate">每首单独生成</option></select></label><p class="footer-note">无音乐的曲目静音生成；音乐引用存在但文件缺失时，会先提示重新连接。排练视频没有两分钟限制。</p><button id="startVideoExport" class="gold">开始生成视频</button>`);
 $('#startVideoExport').onclick=()=>{const ids=$$('[data-video-song]:checked').map(input=>input.dataset.videoSong);if(!ids.length){toast(tr('请至少选择一首曲目。'));return;}startStageVideoExport({ids,withAudio:$('#videoWithAudio').checked,combined:$('#videoGrouping').value==='combined'});};
}
function videoWorkspaceSnapshot(){return {showId,songId,current,playing,silent:audioSilentMode,scrolls:['#leftContent','#rightPanel','#inspector','#bottomContent','#lyricsList','#singingList'].map(id=>({id,top:$(id).scrollTop,left:$(id).scrollLeft})),rate,tool,stagePhase,selected:[...selected],selectedCue,inspect:{...inspect},rehearsal,singing,focusActor,loop:loop&&{...loop},singleStepEnd,lyricFollow,singingFollow};}
async function restoreVideoWorkspace(saved){
 showId=saved.showId;songId=saved.songId;current=saved.current;rate=saved.rate;tool=saved.tool;stagePhase=saved.stagePhase;selected=saved.selected;selectedCue=saved.selectedCue;inspect=saved.inspect;rehearsal=saved.rehearsal;singing=saved.singing;focusActor=saved.focusActor;loop=saved.loop;singleStepEnd=saved.singleStepEnd;lyricFollow=saved.lyricFollow;singingFollow=saved.singingFollow;
 await loadAudio();positionMusicCursor(saved.current);renderAll();for(const item of saved.scrolls){$(item.id).scrollTop=item.top;$(item.id).scrollLeft=item.left;}if(saved.playing)await play(true,saved.silent);
}
function videoLyricsAt(q,t){const lines=[...q.lyrics].sort((a,b)=>a.start-b.start),upcoming=lines.find(l=>l.start>t);return {current:lines.filter(l=>l.start<=t&&l.end>t).map(l=>l.text).join(' / '),next:upcoming?lines.filter(l=>l.start===upcoming.start).map(l=>l.text).join(' / '):'',hasLyrics:lines.length>0};}
function wrapVideoText(ctx,text,width,maxLines){
 const parts=String(text||'').trim().split(/\s+/),lines=[];let line='';
 for(const word of parts){const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width<=width){line=candidate;continue;}if(line){lines.push(line);line='';}if(ctx.measureText(word).width>width){for(const character of word){if(ctx.measureText(line+character).width>width){lines.push(line);line='';}line+=character;}}else line=word;}
 if(line)lines.push(line);if(lines.length>maxLines){lines.length=maxLines;let last=lines.at(-1);while(last&&ctx.measureText(last+'…').width>width)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}return lines;
}
function drawVideoLyrics(ctx,canvas,lyrics){
 if(!lyrics.hasLyrics)return;const height=148,top=canvas.height-height;ctx.fillStyle='#171a1d';ctx.fillRect(0,top,canvas.width,height);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 25px system-ui, sans-serif';ctx.fillStyle='#fff';const now=wrapVideoText(ctx,lyrics.current||'♪',canvas.width-80,2);now.forEach((line,i)=>ctx.fillText(line,canvas.width/2,top+25+i*30));ctx.font='18px system-ui, sans-serif';ctx.fillStyle='#bdc5ca';const next=wrapVideoText(ctx,lyrics.next?tr('下一句：')+lyrics.next:'',canvas.width-80,2);next.forEach((line,i)=>ctx.fillText(line,canvas.width/2,top+96+i*23));
}
async function drawStageVideoFrame(canvas){
 renderStage();const lyrics=videoLyricsAt(song(),current),stageHeight=canvas.height-(lyrics.hasLyrics?148:0),svg=$('#stage').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width',canvas.width);svg.setAttribute('height',stageHeight);svg.setAttribute('preserveAspectRatio','xMidYMid meet');
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'})),image=new Image();
 try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error(tr('舞台画面无法生成视频。')));image.src=url;});const ctx=canvas.getContext('2d');ctx.fillStyle='#e8e2d3';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,stageHeight);drawVideoLyrics(ctx,canvas,lyrics);}finally{URL.revokeObjectURL(url);}
}
async function waitVideoFrame(){return new Promise(resolve=>setTimeout(resolve,1000/30));}
async function recordStageSong(q,canvas,recording,destination,context,job,index,count){
 job.check();songId=q.id;current=0;selectedCue=null;stagePhase='live';await loadAudio();job.check();
 if(q.audio&&destination&&!audioPlayable())throw Error(ui`音乐未连接：${q.title}`);
 const hasAudio=!!destination&&audioPlayable();if(hasAudio)context.createMediaElementSource(audio).connect(destination);
 const duration=C.total(q,audioDuration);if(!Number.isFinite(duration)||duration<=0)throw Error(ui`曲目没有可播放的时长：${q.title}`);
 await drawStageVideoFrame(canvas);if(hasAudio){audio.currentTime=0;audio.playbackRate=1;await playMediaForProcessing(audio,job);}
 if(recording.recorder.state==='inactive')recording.recorder.start(1000);else if(recording.recorder.state==='paused')recording.recorder.resume();
 let started=performance.now();
 while(current<duration){
  job.check();
  if(document.hidden){const hiddenAt=performance.now();if(recording.recorder.state==='recording')recording.recorder.pause();audio.pause();job.report(index/count,tr('页面暂时不可见，生成已暂停；返回此页后继续。'));while(document.hidden){job.check();await new Promise(resolve=>setTimeout(resolve,200));}started+=performance.now()-hiddenAt;if(context?.state==='suspended')await resumeMediaContext(context,job);if(hasAudio&&!audio.ended)await playMediaForProcessing(audio,job);if(recording.recorder.state==='paused')recording.recorder.resume();}
  const elapsed=(performance.now()-started)/1000;
  current=Math.min(duration,hasAudio&&!audio.ended&&audio.currentTime<audioDuration-.04?audio.currentTime:elapsed);
  if(hasAudio&&audio.error)throw Error(tr('音乐播放中断，视频未完成。'));
  await drawStageVideoFrame(canvas);job.report((index+current/duration)/count,ui`${q.title} · ${fmt(current)} / ${fmt(duration)} · ${index+1} / ${count}`);await waitVideoFrame();
 }
 audio.pause();if(recording.recorder.state==='recording')recording.recorder.pause();
}
async function startStageVideoExport(options){
 if(videoExporting||stepMediaBusy)return;const songs=show().songs.filter(q=>options.ids.includes(q.id));if(!songs.length)return;
 const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
 if(!mediaCodec()||!canvas.captureStream){toast(tr('此浏览器暂不支持视频生成，请使用新版 Chrome、Edge 或 Safari。'));return;}
 const saved=videoWorkspaceSnapshot();videoExporting=true;const job=mediaProgress(tr('正在生成排练视频'));let context,destination,recording;const results=[];
 try{
  if(options.withAudio){const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw Error(tr('此浏览器无法录制音乐，请关闭“包含音乐”或换用新版浏览器。'));context=new AudioContext();destination=context.createMediaStreamDestination();await resumeMediaContext(context,job);}
  singing=false;rehearsal=false;selected=[];selectedCue=null;tool='select';stagePhase='live';rate=1;loop=null;singleStepEnd=null;lyricFollow=false;singingFollow=false;renderAll();
  const groups=options.combined?[songs]:songs.map(q=>[q]);
  for(const group of groups){
   job.check();recording=createCanvasRecorder(canvas,destination?.stream.getAudioTracks()[0]);
   for(let i=0;i<group.length;i++)await recordStageSong(group[i],canvas,recording,destination,context,job,i,group.length);
   recording.stop();const blob=await recording.done;job.check();if(!blob.size)throw Error(tr('视频生成失败。'));
   const name=(group.length>1?show().title+'-'+tr('排练视频'):group[0].title).replace(/[\\/:*?"<>|]/g,'-'),extension=blob.type.startsWith('video/mp4')?'mp4':'webm';results.push({blob,name:name+'.'+extension});
   // The shared destination track stays alive for subsequent separately recorded songs.
   recording.stream.getVideoTracks().forEach(track=>track.stop());recording=null;
  }
 }catch(error){if(error.name!=='AbortError')toast(error.message);results.length=0;}
 finally{recording?.stop();recording?.dispose();audio.pause();await context?.close();destination?.stream.getTracks().forEach(track=>track.stop());job.dispose();closeModal();await restoreVideoWorkspace(saved);videoExporting=false;}
 if(results.length){modal(tr('排练视频已生成'),ui`<p>视频已在本机生成，点击下载保存。</p><div class="stack">${results.map((r,i)=>`<button class="gold" data-video-download="${i}">${esc(r.name)}</button>`).join('')}</div>`);for(const button of $$('[data-video-download]'))button.onclick=()=>{const result=results[+button.dataset.videoDownload];download(result.blob,result.name);};}
}
