/* Timeline view state does not change the saved show unless a clip is edited. */
const TIMELINE_LABEL=120;
let timelineZoom=1,timelineDrag=null;
const timeRound=n=>Math.round(n*10)/10;
function timelineMetrics(){
 const viewport=$('#bottomContent'),total=time(),width=Math.max(240,viewport.clientWidth-TIMELINE_LABEL);
 return{total,pixelsPerSecond:timelineDrag?.pixelsPerSecond||width/total*timelineZoom};
}
function renderTimeline(){
 const viewport=$('#bottomContent'),scrollLeft=viewport.scrollLeft,scrollTop=viewport.scrollTop,{total,pixelsPerSecond}=timelineMetrics(),q=song();
 const width=TIMELINE_LABEL+total*pixelsPerSecond,step=[.1,.2,.5,1,2,5,10,15,30,60,120,300,600,1800].find(n=>n*pixelsPerSecond>=65)||10**Math.ceil(Math.log10(65/pixelsPerSecond));
 let html=`<div class="timeline clip-timeline" style="width:${width}px"><div class="ruler" data-seek="true">`;
 for(let t=0;t<=total;t+=step)html+=`<span class="tick" style="left:${t*pixelsPerSecond}px">${fmt(t,step<1?1:0)}</span>`;
 html+='</div>';const events=C.events(q);
 const clip=(e,m,color)=>{const span=m?C.moveEvent(e,m):e,active=selectedCue===e.cue.id&&(!m||selected.includes(m.entityId)),name=m?displayName(entity(m.entityId)):e.cue.title;
  return ui`<div class="cuebar ${m?'actor-clip':'step-clip'} ${active?'active':''}" data-timeline-bar="${m?'move':'cue'}" data-cue="${esc(e.cue.id)}" ${m?`data-move="${esc(m.id)}"`:''} role="button" tabindex="0" aria-label="${esc(name)}，${fmt(span.start)}开始，持续${span.duration}秒" title="${esc(name)} · ${fmt(span.start)}–${fmt(span.end)} · 拖动移动，拖两端调整时长" style="left:${span.start*pixelsPerSecond}px;width:${Math.max(14,span.duration*pixelsPerSecond)}px;background:${color}">${m||q.mode==='timed'?tr('<span class="clip-edge left-edge" data-timeline-edge="left" title="拖动调整开始时间"></span>'):''}<span class="clip-caption">${esc(m?m.notes||e.cue.title:e.cue.title)}</span><span class="clip-edge right-edge" data-timeline-edge="right" title="拖动调整结束时间"></span></div>`;
 };
 html+=tr('<div class="lane"><div class="lanename">走台步骤</div><div class="lanetrack" data-seek="true">')+events.map(e=>clip(e,null,'#8b7046')).join('')+'</div></div>';
 for(const en of activeEntities())html+=`<div class="lane"><div class="lanename" data-entity="${esc(en.id)}" title="${esc(en.name)}">${esc(en.label)} · ${esc(en.name)}</div><div class="lanetrack" data-seek="true">`+events.flatMap(e=>e.cue.moves.filter(m=>m.entityId===en.id).map(m=>clip(e,m,safeColor(en.color)))).join('')+'</div></div>';
 html+='<div class="playhead" id="playhead"></div></div>';viewport.innerHTML=html;viewport.scrollLeft=scrollLeft;viewport.scrollTop=scrollTop;
 $('#timelineZoom').value=Math.log2(timelineZoom);$('#timelineZoomLabel').textContent=(Math.round(timelineZoom*10)/10)+'×';updatePlayhead();
}
function setTimelineZoom(value,anchor){
 const viewport=$('#bottomContent'),old=timelineMetrics(),cursorX=TIMELINE_LABEL+current*old.pixelsPerSecond-viewport.scrollLeft,x=anchor??(cursorX>=TIMELINE_LABEL&&cursorX<=viewport.clientWidth?cursorX:viewport.clientWidth/2),at=anchor===undefined?current:(viewport.scrollLeft+x-TIMELINE_LABEL)/old.pixelsPerSecond;
 timelineZoom=Math.max(1,Math.min(64,value));renderTimeline();const next=timelineMetrics();viewport.scrollLeft=Math.max(0,at*next.pixelsPerSecond+TIMELINE_LABEL-x);
}
function revealTimelineCursor(){
 if(bottomTab!=='timeline')return;const viewport=$('#bottomContent'),x=TIMELINE_LABEL+current*timelineMetrics().pixelsPerSecond;
 if(x<viewport.scrollLeft+TIMELINE_LABEL||x>viewport.scrollLeft+viewport.clientWidth-20)viewport.scrollLeft=Math.max(0,x-viewport.clientWidth/2);
}
function timelineAction(a){
 if(!a.startsWith('timeline-'))return false;
 if(a==='timeline-zoom-out')setTimelineZoom(timelineZoom/1.4);
 if(a==='timeline-zoom-in')setTimelineZoom(timelineZoom*1.4);
 if(a==='timeline-fit'){setTimelineZoom(1);$('#bottomContent').scrollLeft=0;}
 return true;
}
function timelineEditValues(base,edge,delta,isMove,mode){
 const start=base.start,duration=base.duration,end=start+duration;
 if(isMove){
  if(edge==='left'){const next=Math.max(base.cueStart,Math.min(end-.1,Math.max(base.cueStart,start+delta)));return{startOffset:timeRound(next-base.cueStart),duration:Math.max(.1,timeRound(end-next))};}
  if(edge==='right')return{startOffset:timeRound(start-base.cueStart),duration:Math.max(.1,timeRound(duration+delta))};
  return{startOffset:Math.max(0,timeRound(start-base.cueStart+delta)),duration};
 }
 if(edge==='right')return{duration:Math.max(.1,timeRound(duration+delta))};
 if(mode==='steps')return{};
 if(edge==='left'){const next=Math.max(0,Math.min(end-.1,Math.max(0,start+delta)));return{at:timeRound(next),duration:Math.max(.1,timeRound(end-next))};}
 return{at:Math.max(0,timeRound(start+delta))};
}
function moveTimingFields(en,event,move){
 const t=C.moveEvent(event,move||{}),custom=move&&(move.startOffset!==undefined||move.duration!==undefined);
 return ui`<section class="move-timing"><div class="move-timing-heading"><b>移动时间</b><button data-action="timeline-follow-step" id="moveTimingReset" ${custom?'':'disabled'}>跟随步骤</button></div><div class="two"><label class="field"><span>本步开始后（秒）</span><input aria-label="演员开始移动的延迟秒数" data-move-time="startOffset" type="number" min="0" step="0.1" value="${move?.startOffset??0}"></label><label class="field"><span>移动用时（秒）</span><input aria-label="演员移动时长秒数" data-move-time="duration" type="number" min="0" step="0.1" value="${t.duration}"></label></div><p id="moveTimingSummary" class="context-tip">${moveTimingSummary(event,move||{})}</p></section>`;
}
function moveTimingSummary(e,m){const t=C.moveEvent(e,m);return ui`音乐 ${fmt(t.start)} → ${fmt(t.end)}${t.end>e.end+.01?tr(' · 延续到本步之后'):''}`;}
function focusTimelineBar(cueId,moveId){const bar=$$('[data-timeline-bar]').find(n=>n.dataset.cue===cueId&&(n.dataset.move||'')===(moveId||''));bar?.focus({preventScroll:true});}
function findTimelineSelection(bar){
 const e=C.events(song()).find(e=>e.cue.id===bar.dataset.cue);if(!e)return null;
 const move=bar.dataset.move?e.cue.moves.find(m=>m.id===bar.dataset.move):null;return{e,move};
}
$('#timelineZoom').addEventListener('input',e=>setTimelineZoom(2**Number(e.target.value)));
$('#bottomContent').addEventListener('wheel',e=>{if(bottomTab!=='timeline'||!(e.ctrlKey||e.metaKey))return;e.preventDefault();const rect=$('#bottomContent').getBoundingClientRect();setTimelineZoom(timelineZoom*Math.exp(-e.deltaY*.008),e.clientX-rect.left);},{passive:false});
$('#bottomContent').addEventListener('pointerdown',ev=>{
 if(bottomTab!=='timeline'||ev.button!==0)return;
 const bar=ev.target.closest('[data-timeline-bar]');
 if(!bar){const lane=ev.target.closest('[data-seek]');if(lane){pause();const rect=lane.getBoundingClientRect();seek((ev.clientX-rect.left)/rect.width*time());}return;}
 const found=findTimelineSelection(bar);if(!found)return;ev.preventDefault();const {e,move}=found;if(rehearsal){pause();selectedCue=e.cue.id;if(move&&song().castIds.includes(move.entityId))focusActor=move.entityId;seek(move?C.moveEvent(e,move).start:e.start);renderAll();return;}pause();selectedCue=e.cue.id;tool='select';stagePhase='end';
 selected=move?[move.entityId]:[];inspect={type:move?'entity':'cue',id:move?.entityId||e.cue.id};
 const viewport=$('#bottomContent'),metrics=timelineMetrics(),base=move?C.moveEvent(e,move):e;
 timelineDrag={pixelsPerSecond:metrics.pixelsPerSecond};const origin=ev.clientX,initialScroll=viewport.scrollLeft,edge=ev.target.closest('[data-timeline-edge]')?.dataset.timelineEdge,mode=song().mode;let started=false,notified=false;
 renderAll();
 const onMove=event=>{
  if(!started&&Math.abs(event.clientX-origin)<3)return;
  if(!move&&mode==='steps'&&edge!=='right'){if(!notified){toast(tr('顺序步骤通过调整时长或前后排序改变时间；演员的色条可独立拖动。'));notified=true;}return;}
  if(!started){snapshot();started=true;}
  const rect=viewport.getBoundingClientRect();if(event.clientX>rect.right-20)viewport.scrollLeft+=15;else if(event.clientX<rect.left+TIMELINE_LABEL+15)viewport.scrollLeft-=15;
  const delta=(event.clientX-origin+viewport.scrollLeft-initialScroll)/metrics.pixelsPerSecond,values=timelineEditValues(base,edge,delta,!!move,mode);
  Object.assign(move||e.cue,values);changed();renderTimeline();renderInspector();renderStage();updateTransport();
 };
 const finish=()=>{document.removeEventListener('pointermove',onMove);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',finish);timelineDrag=null;if(started)renderAll();focusTimelineBar(e.cue.id,move?.id);};
 document.addEventListener('pointermove',onMove);document.addEventListener('pointerup',finish,{once:true});document.addEventListener('pointercancel',finish,{once:true});
});
$('#bottomContent').addEventListener('keydown',ev=>{
 const bar=ev.target.closest('[data-timeline-bar]');if(rehearsal||!bar||!['ArrowLeft','ArrowRight'].includes(ev.key))return;ev.preventDefault();ev.stopPropagation();const found=findTimelineSelection(bar);if(!found)return;
 const {e,move}=found,delta=(ev.key==='ArrowLeft'?-1:1)*(ev.shiftKey?1:.1),base=move?C.moveEvent(e,move):e;
 if(!move&&song().mode==='steps')return;mutate(()=>Object.assign(move||e.cue,timelineEditValues(base,null,delta,!!move,song().mode)));focusTimelineBar(e.cue.id,move?.id);
});
document.addEventListener('change',ev=>{
 const input=ev.target;if(!input.matches('[data-move-time]'))return;const e=selectedEvent(),id=selected[0];if(!e||selected.length!==1)return;
 const value=Number(input.value);if(input.value===''||!Number.isFinite(value)||value<0){toast(tr('请输入不小于 0 的秒数。'));renderInspector();return;}
 pause();stagePhase='end';
 mutate(()=>{let move=e.cue.moves.find(m=>m.entityId===id);if(!move){C.setDestinations(song(),e.cue.id,{[id]:C.beforeCue(song(),e.cue.id,id)},linkNext);move=e.cue.moves.find(m=>m.entityId===id);}move.startOffset??=0;move.duration??=e.duration;move[input.dataset.moveTime]=value;},false);
 const move=e.cue.moves.find(m=>m.entityId===id);renderEditorBar();$('#moveTimingSummary').textContent=moveTimingSummary(e,move);$('#moveTimingReset').disabled=false;
 issuesCache=C.issues(show(),song());$('#issuesButton').textContent=issuesCache.length?ui`${issuesCache.length} 处待检查`:tr('检查走台');$('#issuesButton').classList.toggle('warning',issuesCache.some(i=>i.level==='error'));renderBottom();renderStage();updateTransport();
});
