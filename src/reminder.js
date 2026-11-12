/* The lighting desk follows the same clock as the stage and the lyrics. */
let reminderOpen=false,reminderContext=null,reminderStroke=null;
let reminderFollow=true,reminderLyricsKey=null,reminderLines=[],reminderLineKey=null;
let reminderTimeline=[],reminderCueKey='',reminderMoves=[],reminderMoveKey=null,reminderGhosts=[];
const reminderPanel=$('#reminderPanel'),reminderStage=$('#reminderStage'),reminderWorld=$('#reminderWorld');
const reminderLyrics=$('#reminderLyrics');

function lightingTimeline(q){
 const starts=new Map(q.lyrics.map(line=>[line.id,line.start]));
 return (q.lightingCues||[]).map(cue=>{
  const lyricStart=starts.get(cue.lyricId);
  return {cue,at:C.finite(lyricStart)&&lyricStart>=0?lyricStart:cue.at};
 }).sort((a,b)=>a.at-b.at);
}
function reminderPlaybackEnd(){
 return Math.max(time(),(reminderTimeline.at(-1)?.at??0)+.1);
}
function reminderCues(at){
 const nextIndex=reminderTimeline.findIndex(event=>event.at>at);
 const previous=reminderTimeline[nextIndex<0?reminderTimeline.length-1:nextIndex-1];
 const upcoming=reminderTimeline[nextIndex];
 return {
  previous:previous?reminderTimeline.filter(event=>event.at===previous.at):[],
  upcoming:upcoming?reminderTimeline.filter(event=>event.at===upcoming.at):[]
 };
}

function openReminder(){
 if(reminderOpen)return;
 if(singing)exitSinging();
 if(songVideoOpen)leaveSongVideo();
 pause();
 reminderContext={showId,songId,loop,rate};
 singleStepEnd=null;loop=null;rate=1;audio.playbackRate=1;
 reminderOpen=true;reminderFollow=true;reminderLyricsKey=null;reminderLineKey=null;
 renderAll();seek(Math.min(current,reminderPlaybackEnd()),{preview:true});
}
function leaveReminder(){
 if(!reminderOpen)return;
 cancelReminderStroke();cancelReminderRail();
 reminderOpen=false;pause();void exitReminderFullscreen();
 if(reminderContext.showId===showId&&reminderContext.songId===songId)loop=reminderContext.loop;
 rate=reminderContext.rate;audio.playbackRate=rate;reminderContext=null;
}
function renderReminder(){
 $('#workspace').classList.toggle('reminder-mode',reminderOpen);
 document.body.classList.toggle('reminder-active',reminderOpen);
 reminderPanel.classList.toggle('hidden',!reminderOpen);
 const tab=$('#reminderMode');
 tab.classList.toggle('selected',reminderOpen);tab.setAttribute('aria-pressed',String(reminderOpen));
 if(!reminderOpen)return;
 const q=song(),picker=$('#reminderSong');
 const options=show().songs.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.title)+'</option>').join('');
 if(picker.innerHTML!==options)picker.innerHTML=options;
 picker.value=q.id;
 reminderTimeline=lightingTimeline(q);reminderCueKey='';
 reminderMoves=C.events(q);reminderMoveKey=null;reminderGhosts=[];
 renderReminderRail();
 const {width,height}=stageViewBounds(show().stage),turned=rotation%180!==0;
 const vw=turned?height:width,vh=turned?width:height;
 reminderStage.setAttribute('viewBox',[-vw/2,-vh/2,vw,vh].join(' '));
 reminderWorld.setAttribute('transform','rotate('+rotation+')');
 const visualScale=Math.max(.2,Math.min(reminderStage.clientWidth/vw,reminderStage.clientHeight/vh));
 $('#reminderBackdrop').innerHTML=stageBackdrop(show().stage,visualScale)+stageAudience(show().stage,width,height,visualScale);
 if(reminderStroke&&reminderStroke.song!==q)cancelReminderStroke();
 renderReminderSketches();renderReminderLyrics();renderReminderFollow();updateReminder(true);updateReminderFullscreen();
}
function reminderMarker(ent,p,ghost=false){
 const color=safeColor(ent.color),label=String(ent.label||ent.name||'?');
 const shape=song().propIds.includes(ent.id)?'<rect x="-4" y="-4" width="8" height="8" rx="1"':'<circle r="4"';
 return '<g class="'+(ghost?'reminder-ghost':'reminder-live')+'" transform="translate('+p.x+' '+p.y+')">'+
  shape+' fill="'+(ghost?'#f3ecd9':color)+'" stroke="'+(ghost?'#302b25':'#fffaf0')+'" stroke-width=".65"'+(ghost?' stroke-dasharray="1.5 1"':'')+'/>'+
  '<text transform="rotate('+(-rotation)+')" y=".15" text-anchor="middle" dominant-baseline="middle" fill="'+(ghost?'#302b25':'#fff')+'" font-size="'+Math.min(4,12/label.length)+'" font-weight="700">'+esc(label)+'</text></g>';
}
function updateReminder(immediate=false){
 if(!reminderOpen||!song())return;
 const {previous,upcoming}=reminderCues(current),next=upcoming[0];
 const nextKey=JSON.stringify([previous.map(event=>event.cue.id),upcoming.map(event=>event.cue.id)]);
 if(reminderCueKey!==nextKey){
  reminderCueKey=nextKey;
  $('#reminderNext').textContent=next?upcoming.map(event=>event.cue.text).join('\n'):tr(reminderTimeline.length?'本曲没有后续提醒':'还没有灯光提醒');
  $('#reminderCurrent').textContent=previous.map(event=>event.cue.text).join(' / ');
  $('#reminderNow').classList.toggle('hidden',!previous.length);
 }
 const remaining=next?next.at-current:0;
 $('#reminderCountdown').textContent=next?(Math.ceil(remaining*10)/10).toFixed(1):'—';
 $('#reminderSeconds').classList.toggle('hidden',!next);
 reminderPanel.classList.toggle('cue-near',!!next&&remaining<=3);
 reminderPanel.classList.toggle('cue-now',!!previous.length&&current-previous[0].at<1.2);
 const moveStart=reminderMoves.find(event=>event.start>current&&event.cue.moves.length)?.start??null;
 if(moveStart!==reminderMoveKey){
  reminderMoveKey=moveStart;
  const byActor=new Map();
  for(const event of reminderMoves)if(event.start===moveStart)for(const move of event.cue.moves){
   const ent=entity(move.entityId),end=move.points.at(-1);
   if(ent&&C.point(end))byActor.set(ent.id,{ent,end});
  }
  reminderGhosts=[...byActor.values()];
 }
 const positions=new Map(activeEntities().map(ent=>[ent.id,{ent,p:C.position(song(),ent.id,current)}]));
 const ghosts=$('#reminderOnion').checked?reminderGhosts.filter(({ent,end})=>{
  const p=positions.get(ent.id)?.p;
  return positions.has(ent.id)&&(!p||Math.hypot(p.x-end.x,p.y-end.y)>.2);
 }).map(({ent,end})=>reminderMarker(ent,end,true)).join(''):'';
 $('#reminderActors').innerHTML=ghosts+[...positions.values()].filter(({p})=>p).map(({ent,p})=>reminderMarker(ent,p)).join('');
 const duration=reminderPlaybackEnd(),playButton=$('#reminderPlay');
 updateReminderRail(duration);
 $('#reminderClock').textContent=fmt(current)+' / '+fmt(duration);
 playButton.textContent=playing?'Ⅱ':'▶';playButton.setAttribute('aria-label',tr(playing?'暂停':'播放'));
 const disconnected=!audioPlayable()&&audioState!=='loading';
 $('#reminderAudio').classList.toggle('hidden',!disconnected);
 $('#reminderSilent').classList.toggle('hidden',!disconnected&&!(playing&&audioSilentMode));
 updateReminderLyrics(immediate);
}
function renderReminderLyrics(){
 const key=JSON.stringify([showId,songId,song().lyrics,StageI18n.language]);
 if(key===reminderLyricsKey)return;
 reminderLyricsKey=key;reminderLineKey=null;
 reminderLines=[...song().lyrics].sort((a,b)=>a.start-b.start||a.end-b.end);
 reminderLyrics.classList.toggle('has-lines',!!reminderLines.length);
 reminderLyrics.innerHTML=reminderLines.map((line,index)=>'<button class="reminder-line" data-action="reminder-lyric:'+index+'"><time>'+fmt(line.start)+'</time><span>'+esc(line.text)+'</span></button>').join('')||
  '<p class="empty">'+tr('这首歌还没有歌词。')+'</p>';
}
function updateReminderLyrics(immediate=false){
 const active=reminderLines.map((line,index)=>line.start<=current&&line.end>current?index:-1).filter(index=>index>=0);
 const anchor=active[0]??reminderLines.findIndex(line=>line.start>current);
 const index=anchor===-1?reminderLines.length-1:anchor,key=active.join(',')+':'+index;
 if(!immediate&&key===reminderLineKey)return;
 reminderLineKey=key;
 const rows=[...reminderLyrics.querySelectorAll('.reminder-line')];
 rows.forEach((row,i)=>{
  const on=active.includes(i);
  row.classList.toggle('active',on);row.setAttribute('aria-current',String(on));
 });
 if(reminderFollow&&rows[index]){
  reminderLyrics.style.setProperty('--lyric-edge',reminderLyrics.clientHeight/2+'px');
  centerLyricRow(reminderLyrics,rows[index],immediate);
 }
}
function renderReminderFollow(){
 const button=$('#reminderFollow');
 button.textContent=tr(reminderFollow?'跟随播放':'回到当前句');button.setAttribute('aria-pressed',String(reminderFollow));
}
function setReminderFollow(follow){
 if(!follow&&!reminderFollow)return;
 reminderFollow=follow;renderReminderFollow();
 if(follow)updateReminderLyrics(true);
}

function reminderStrokePath(stroke){
 const first=stroke.points[0];
 if(!first)return '';
 // A tiny round-ended line also makes a click or tap leave a visible dot.
 const points=stroke.points.length===1?[first,{x:first.x+.01,y:first.y}]:stroke.points;
 return '<path d="'+C.path(points)+'" fill="none" stroke="'+stroke.color+'" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
}
function renderReminderSketches(){
 const strokes=song()?.lightingSketches||[];
 $('#reminderSketches').innerHTML=strokes.map(reminderStrokePath).join('');
 $('#reminderUndo').disabled=$('#reminderClear').disabled=!strokes.length;
}
function reminderPoint(event){
 const matrix=reminderWorld.getScreenCTM();
 if(!matrix)return null;
 const cursor=reminderStage.createSVGPoint();
 cursor.x=event.clientX;cursor.y=event.clientY;
 const p=cursor.matrixTransform(matrix.inverse());
 return {x:Math.round(p.x*100)/100,y:Math.round(p.y*100)/100};
}
function addReminderPoint(event){
 const p=reminderPoint(event),points=reminderStroke.points,last=points.at(-1);
 if(!C.point(p)||last&&Math.hypot(p.x-last.x,p.y-last.y)<.35)return;
 points.push(p);
 $('#reminderDraft').innerHTML=reminderStrokePath(reminderStroke);
}
function cancelReminderStroke(){
 if(!reminderStroke)return;
 const id=reminderStroke.pointerId;
 reminderStroke=null;$('#reminderDraft').innerHTML='';
 if(reminderStage.hasPointerCapture(id))reminderStage.releasePointerCapture(id);
}
reminderStage.addEventListener('pointerdown',event=>{
 if(!reminderOpen||reminderStroke||event.button!==0)return;
 event.preventDefault();
 const color=$('#reminderColor').value;
 reminderStroke={pointerId:event.pointerId,song:song(),color:/^#[0-9a-f]{6}$/i.test(color)?color:'#c32c50',points:[]};
 reminderStage.setPointerCapture(event.pointerId);addReminderPoint(event);
});
reminderStage.addEventListener('pointermove',event=>{
 if(reminderStroke?.pointerId===event.pointerId)addReminderPoint(event);
});
reminderStage.addEventListener('pointerup',event=>{
 if(reminderStroke?.pointerId!==event.pointerId)return;
 addReminderPoint(event);
 const {song:owner,color,points}=reminderStroke;
 cancelReminderStroke();
 if(owner!==song()||!points.length)return;
 mutate(()=>{(owner.lightingSketches??=[]).push({color,points});},false);renderReminderSketches();
});
for(const type of ['pointercancel','lostpointercapture'])reminderStage.addEventListener(type,event=>{
 if(reminderStroke?.pointerId===event.pointerId)cancelReminderStroke();
});

function reminderInputTime(at){return String(Math.round(at*1000)/1000);}
function editReminder(id){
 const q=song(),item=reminderTimeline.find(({cue})=>cue.id===id);
 pause();
 const lines=[...q.lyrics].sort((a,b)=>a.start-b.start);
 const lyricOptions=lines.map(line=>'<option value="'+esc(line.id)+'">'+fmt(line.start)+' · '+esc(line.text.slice(0,100))+'</option>').join('');
 modal(tr(item?'编辑提醒':'添加提醒'),ui`<form id="reminderForm">
  <label class="field"><span>提醒文字</span><textarea id="reminderText" required placeholder="例如：追光给到舞台中央"></textarea></label>
  <div class="reminder-form-time"><span>${tr('提醒时间')}</span> <output id="reminderAtLabel"></output></div>
  ${lines.length?ui`<label class="field"><span>吸附歌词</span><select id="reminderLyricPicker"><option value="">自由时间</option>${lyricOptions}</select></label>`:''}
  <details id="reminderExact"><summary>精确输入时间</summary><label class="field"><input id="reminderAt" type="text" aria-label="提醒时间" placeholder="秒数或 分:秒" autocomplete="off"></label></details>
  <p id="reminderError" class="warning" role="status"></p>
  <div class="dialogactions">${item?'<button type="button" class="danger" id="reminderDelete">'+tr('删除提醒')+'</button>':''}<button type="button" data-action="reminder-cancel">取消</button><button class="gold" type="submit">保存</button></div>
 </form>`);
 const lyricPicker=lines.length?$('#reminderLyricPicker'):null,input=$('#reminderText');
 const atInput=$('#reminderAt'),exact=$('#reminderExact'),error=$('#reminderError');
 const findLyric=()=>lines.find(line=>line.id===lyricPicker?.value);
 const updateTime=()=>{
  const line=findLyric();
  if(line)atInput.value=reminderInputTime(line.start);
  exact.classList.toggle('hidden',!!line);atInput.disabled=!!line;
  const at=parsePlaybackTime(atInput.value);
  $('#reminderAtLabel').textContent=at===null?'—':fmt(at,3).replace(/0+$/,'').replace(/\.$/,'');
 };
 if(lyricPicker){
  lyricPicker.value=lines.some(line=>line.id===item?.cue.lyricId)?item.cue.lyricId:'';
  lyricPicker.onchange=updateTime;
 }
 input.value=item?.cue.text||'';atInput.value=reminderInputTime(item?.at??current);
 atInput.oninput=updateTime;updateTime();
 if(item)$('#reminderDelete').onclick=()=>{
  if(q!==song())return;
  mutate(()=>{
   q.lightingCues=q.lightingCues.filter(cue=>cue.id!==id);
   if(!q.lightingCues.length)delete q.lightingCues;
  });
  closeModal();
 };
 $('#reminderForm').onsubmit=event=>{
  event.preventDefault();
  if(q!==song())return;
  const line=findLyric(),at=line?.start??parsePlaybackTime(atInput.value),text=input.value.trim();
  if(!C.finite(at)||at<0||at>86400){
   exact.open=true;error.textContent=tr('请输入有效的提醒时间。');atInput.focus();return;
  }
  if(!text){input.focus();return;}
  const cue={id:item?.cue.id||C.id('lighting'),at,text};
  if(line)cue.lyricId=line.id;
  mutate(()=>{
   const cues=q.lightingCues??=[],index=cues.findIndex(entry=>entry.id===cue.id);
   if(index<0)cues.push(cue);else cues[index]=cue;
  });
  closeModal();focusReminderClip(cue.id);
 };
 input.focus();
}
function reminderIsFullscreen(){return stageFullscreenElement()===reminderPanel;}
function updateReminderFullscreen(){
 const active=reminderIsFullscreen()||reminderPanel.classList.contains('reminder-viewport'),button=$('#reminderFullscreen');
 button.textContent=tr(active?'退出全屏（Esc）':'全屏');button.setAttribute('aria-pressed',String(active));
}
async function exitReminderFullscreen(){
 reminderPanel.classList.remove('reminder-viewport');
 if(reminderIsFullscreen())try{await (document.exitFullscreen||document.webkitExitFullscreen)?.call(document);}catch{}
 updateReminderFullscreen();
}
async function toggleReminderFullscreen(){
 if(reminderIsFullscreen()||reminderPanel.classList.contains('reminder-viewport'))return exitReminderFullscreen();
 try{
  const request=reminderPanel.requestFullscreen||reminderPanel.webkitRequestFullscreen;
  if(request)await request.call(reminderPanel);
 }catch{}
 if(reminderOpen&&!reminderIsFullscreen())reminderPanel.classList.add('reminder-viewport');
 updateReminderFullscreen();updateReminderLyrics(true);
}
for(const type of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(type,()=>{
 updateReminderFullscreen();if(reminderOpen)updateReminderLyrics(true);
});
function toggleReminderPlayback(){
 if(playing){pause();return;}
 return play(true,!song().audio||!audioPlayable()&&audioState!=='loading');
}
function handleReminderKey(event,typing,cmd){
 if(cmd&&['z','y','o'].includes(event.key.toLowerCase()))return false;
 if(event.key==='Escape'){
  event.preventDefault();
  if(reminderIsFullscreen()||reminderPanel.classList.contains('reminder-viewport'))void exitReminderFullscreen();
  else{leaveReminder();renderAll();$('#reminderMode').focus();}
 }else if(event.code==='Space'&&!typing&&!event.target.closest?.('button,select,input')){
  event.preventDefault();void toggleReminderPlayback();
 }
 return true;
}
async function reminderAction(action){
 if(!reminderOpen)return;
 if(action==='reminder-exit'){leaveReminder();renderAll();$('#reminderMode').focus();}
 else if(action==='reminder-fullscreen')await toggleReminderFullscreen();
 else if(action==='reminder-play')await toggleReminderPlayback();
 else if(action==='reminder-follow')setReminderFollow(true);
 else if(action==='reminder-audio')$('#audioInput').click();
 else if(action==='reminder-add')editReminder();
 else if(action.startsWith('reminder-edit:'))editReminder(action.slice('reminder-edit:'.length));
 else if(action==='reminder-zoom-out')setReminderRailZoom(reminderRailZoom/1.6);
 else if(action==='reminder-zoom-in')setReminderRailZoom(reminderRailZoom*1.6);
 else if(action==='reminder-fit'){setReminderRailZoom(1);reminderRail.scrollLeft=0;}
 else if(action==='reminder-cancel')closeModal();
 else if(action==='reminder-undo'||action==='reminder-clear'){
  const q=song();
  if(!q.lightingSketches?.length)return;
  mutate(()=>{
   if(action==='reminder-undo')q.lightingSketches.pop();
   if(action==='reminder-clear'||!q.lightingSketches.length)delete q.lightingSketches;
  },false);renderReminderSketches();
 }else if(action.startsWith('reminder-lyric:')){
  const line=reminderLines[+action.slice('reminder-lyric:'.length)];
  if(line){seek(line.start,{preview:true});revealReminderCursor();setReminderFollow(true);}
 }
}
$('#reminderSong').addEventListener('change',event=>{
 cancelReminderStroke();cancelReminderRail();setReminderFollow(true);void switchSong(event.target.value);
});
$('#reminderOnion').addEventListener('change',()=>updateReminder());
for(const type of ['wheel','touchmove'])reminderLyrics.addEventListener(type,()=>setReminderFollow(false),{passive:true});
reminderLyrics.addEventListener('keydown',event=>{
 if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(event.key))setReminderFollow(false);
});
