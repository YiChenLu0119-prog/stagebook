/* Point cues share the blocking timeline's ruler, playhead and zoom conventions. */
const REMINDER_INSET=16;
const reminderRail=$('#reminderRail'),reminderTrack=$('#reminderTrack'),reminderClips=$('#reminderClips');
const reminderHead=$('#reminderPlayhead'),reminderHandle=$('#reminderSeek');
let reminderRailZoom=1,reminderRailSong='',reminderRailDrag=null,reminderRailGesture=null;
let reminderRailScale=1,reminderRailWidth=0,reminderRailEnd=0;

function renderReminderRail(duration=reminderPlaybackEnd()){
 const identity=showId+'/'+songId;
 if(reminderRailSong!==identity){
  reminderRailSong=identity;reminderRailZoom=1;reminderRail.scrollLeft=0;
 }
 const width=Math.max(100,reminderRail.clientWidth);
 reminderRailEnd=duration;reminderRailWidth=width;
 reminderRailScale=(width-2*REMINDER_INSET)/duration*reminderRailZoom;
 const trackWidth=duration*reminderRailScale+2*REMINDER_INSET;
 reminderTrack.style.width=trackWidth+'px';
 $('#reminderRuler').innerHTML=timelineRulerTicks(duration,reminderRailScale,REMINDER_INSET);
 const rows=[];
 reminderClips.innerHTML=reminderTimeline.map(({cue,at},index)=>{
  const x=reminderRailX(at),next=reminderTimeline[index+1];
  const room=next?(next.at-at)*reminderRailScale:trackWidth-x;
  const clipWidth=Math.max(26,Math.min(112,room-5,trackWidth-x));
  const left=x-13;
  let row=rows.findIndex(end=>end+4<=left);
  if(row<0)row=rows.length;
  rows[row]=left+clipWidth;
  const label=fmt(at)+' · '+cue.text,linked=cue.lyricId&&song().lyrics.some(line=>line.id===cue.lyricId);
  return '<button type="button" class="cuebar reminder-clip'+(linked?' lyric-linked':'')+'" data-reminder-cue="'+esc(cue.id)+
   '" data-action="reminder-edit:'+esc(cue.id)+'" title="'+esc(label+(linked?' · '+tr('吸附歌词'):''))+
   '" aria-label="'+esc(label)+'" style="left:'+left+'px;top:'+(row*29+3)+'px;width:'+clipWidth+'px">'+
   (clipWidth>=55?'<span>'+esc(cue.text)+'</span>':'<span aria-hidden="true">◆</span>')+'</button>';
 }).join('');
 reminderClips.style.height=Math.max(31,rows.length*29+3)+'px';
 positionReminderPlayhead(duration);
}
function reminderRailX(at){return REMINDER_INSET+at*reminderRailScale;}
function positionReminderPlayhead(duration){
 reminderHead.style.left=reminderRailX(Math.min(current,duration))+'px';
 reminderHandle.setAttribute('aria-valuenow',String(Math.min(current,duration)));
 reminderHandle.setAttribute('aria-valuemax',String(duration));
 reminderHandle.setAttribute('aria-valuetext',fmt(current));
}
function updateReminderRail(duration){
 if(!reminderRailDrag&&(reminderRailEnd!==duration||reminderRailWidth!==Math.max(100,reminderRail.clientWidth)))renderReminderRail(duration);
 positionReminderPlayhead(duration);
 if(playing)revealReminderCursor();
}
function revealReminderCursor(){
 const x=reminderRailX(current),left=reminderRail.scrollLeft;
 if(x<left||x>left+reminderRail.clientWidth-8)reminderRail.scrollLeft=Math.max(0,x-reminderRail.clientWidth*.25);
}
function setReminderRailZoom(zoom,anchor){
 if(reminderRailDrag)return;
 const cursor=reminderRailX(current)-reminderRail.scrollLeft;
 const x=anchor??(cursor>=0&&cursor<=reminderRail.clientWidth?cursor:reminderRail.clientWidth/2);
 const at=(reminderRail.scrollLeft+x-REMINDER_INSET)/reminderRailScale;
 reminderRailZoom=Math.max(1,Math.min(128,zoom));
 renderReminderRail();reminderRail.scrollLeft=Math.max(0,reminderRailX(at)-x);
}
function focusReminderClip(id){
 [...reminderClips.querySelectorAll('[data-reminder-cue]')].find(clip=>clip.dataset.reminderCue===id)?.focus();
}
function reminderTimeAt(x){
 return (x-reminderTrack.getBoundingClientRect().left-REMINDER_INSET)/reminderRailScale;
}
function reminderDragTarget(at,linked){
 const end=Math.min(86400,reminderRailEnd);
 at=Math.max(0,Math.min(end,at));
 if(linked){
  let nearest;
  for(const line of reminderLines)if(line.start>=0&&line.start<=end&&(!nearest||Math.abs(line.start-at)<Math.abs(nearest.start-at)))nearest=line;
  if(nearest)return {at:nearest.start,lyricId:nearest.id};
 }
 return {at:Math.min(end,timeRound(at))};
}
function cancelReminderRail(){
 if(!reminderRailDrag)return;
 const {pointerId}=reminderRailDrag;
 reminderRailDrag=null;
 if(reminderRail.hasPointerCapture(pointerId))reminderRail.releasePointerCapture(pointerId);
}
reminderRail.addEventListener('pointerdown',event=>{
 if(!reminderOpen||reminderRailDrag||event.button!==0)return;
 if(event.clientX>=reminderRail.getBoundingClientRect().left+reminderRail.clientWidth)return;
 const clip=event.target.closest('[data-reminder-cue]');
 const item=clip&&reminderTimeline.find(({cue})=>cue.id===clip.dataset.reminderCue);
 const handle=event.target===reminderHandle;
 const at=reminderTimeAt(event.clientX);
 event.preventDefault();pause();
 reminderRailDrag={pointerId:event.pointerId,song:song(),clip,item,handle,startX:event.clientX,previous:current,
  offset:item?item.at-at:handle?current-at:0,target:null};
 reminderRail.setPointerCapture(event.pointerId);
 if(!item)seek(handle?current:at,{preview:true});
});
function moveReminderRail(event,drag){
 const {item,clip,offset,startX}=drag;
 if(item&&!drag.target&&Math.abs(event.clientX-startX)<3)return;
 const view=reminderRail.getBoundingClientRect();
 if(event.clientX>view.right-18)reminderRail.scrollLeft+=16;
 else if(event.clientX<view.left+18)reminderRail.scrollLeft-=16;
 const at=reminderTimeAt(event.clientX)+offset;
 if(!item){seek(at,{preview:true});return;}
 const linked=item.cue.lyricId&&reminderLines.some(line=>line.id===item.cue.lyricId);
 const target=reminderDragTarget(at,linked);
 drag.target=target;
 clip.style.left=(reminderRailX(target.at)-13)+'px';
 clip.classList.add('active');
 seek(target.at,{preview:true});
}
reminderRail.addEventListener('pointermove',event=>{
 const drag=reminderRailDrag;
 if(drag?.pointerId===event.pointerId&&drag.song===song())moveReminderRail(event,drag);
});
function finishReminderRail(event){
 const drag=reminderRailDrag;
 if(drag?.pointerId!==event.pointerId)return;
 const committed=event.type==='pointerup'&&drag.song===song();
 if(committed&&(!drag.item||drag.target||Math.abs(event.clientX-drag.startX)>=3))moveReminderRail(event,drag);
 cancelReminderRail();
 if(drag.song!==song())return;
 if(!drag.item){if(drag.handle)reminderHandle.focus({preventScroll:true});return;}
 const {cue,at}=drag.item,target=drag.target;
 if(committed&&!target){seek(at,{preview:true});editReminder(cue.id);return;}
 if(committed&&target&&(target.at!==at||target.lyricId!==cue.lyricId)){
  mutate(()=>{cue.at=target.at;if(target.lyricId)cue.lyricId=target.lyricId;else delete cue.lyricId;});
 }else{
  if(!committed)seek(drag.previous,{preview:true});
  renderReminderRail();
 }
 focusReminderClip(cue.id);
}
for(const type of ['pointerup','pointercancel','lostpointercapture'])reminderRail.addEventListener(type,finishReminderRail);
reminderHandle.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
 event.preventDefault();pause();
 const step=(event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:1)*(event.shiftKey?1:.1);
 seek(event.key==='Home'?0:event.key==='End'?reminderPlaybackEnd():current+step,{preview:true});revealReminderCursor();
});
reminderRail.addEventListener('wheel',event=>{
 if(!event.ctrlKey&&!event.metaKey)return;
 event.preventDefault();if(reminderRailGesture)return;
 const rect=reminderRail.getBoundingClientRect(),delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.width:1);
 setReminderRailZoom(reminderRailZoom*Math.exp(-Math.max(-100,Math.min(100,delta))*.008),event.clientX-rect.left);
},{passive:false});
reminderRail.addEventListener('gesturestart',event=>{
 event.preventDefault();const rect=reminderRail.getBoundingClientRect();
 reminderRailGesture={zoom:reminderRailZoom,x:Number.isFinite(event.clientX)?event.clientX-rect.left:rect.width/2};
},{passive:false});
reminderRail.addEventListener('gesturechange',event=>{
 if(!reminderRailGesture)return;
 event.preventDefault();
 if(Number.isFinite(event.scale)&&event.scale>0)setReminderRailZoom(reminderRailGesture.zoom*event.scale,reminderRailGesture.x);
},{passive:false});
reminderRail.addEventListener('gestureend',event=>{if(reminderRailGesture)event.preventDefault();reminderRailGesture=null;},{passive:false});
