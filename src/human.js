/* Human editing tools. Preferences stay in the UI; the v1 show format is unchanged. */
let stagePhase='end',showGhosts=true,snapToGrid=false,linkNext=true,formationClipboard=null;
const humanLiveFields=new WeakSet();
const prettyCoordinate=n=>Math.round(n*100)/100;
const selectedEvent=()=>C.events(song()).find(e=>e.cue.id===selectedCue);
function eventAtCursor(actorId=selected.length===1?selected[0]:null){
 const list=C.events(song());
 // The most recently started move also determines the actor's visible position.
 const move=actorId?C.moveEvents(song()).filter(e=>e.move.entityId===actorId&&e.start<=current).at(-1):null;
 if(move&&move.end>=current)return list.find(e=>e.cue.id===move.cue.id);
 return list.filter(e=>e.start<=current).at(-1)||null;
}
function syncPlaybackContext(){
 if(stagePhase!=='live'||singleStepEnd!==null)return false;
 const e=eventAtCursor(),id=e?.cue.id||null;if(id===selectedCue)return false;
 selectedCue=id;selectedRouteNode=null;
 if(['cue','move','entity','group','song'].includes(inspect.type))inspect=selected.length?{type:selected.length>1?'group':'entity',id:selected[0]}:{type:e?'cue':'song',id:id||songId};
 return true;
}
function prepareHumanScene(){
 selectedCue=song()?.cues[0]?.id||null;stagePhase=selectedCue?'live':'end';tool=selectedCue?'select':'initial';
 inspect={type:selectedCue?'cue':'song',id:selectedCue||songId};current=0;
}
function viewPosition(id,q=song()){
 if(tool==='initial'&&!playing)return q.initial[id];
 if(!playing&&!countdownTimer&&!rehearsal&&stagePhase!=='live'&&selectedCue){
  return stagePhase==='start'?C.beforeCue(q,selectedCue,id):C.cuePosition(q,selectedCue,id);
 }
 return C.position(q,id,current);
}
function chooseStep(id,phase='end',keepSelection=true,keepTime=false){
 pause();singleStepEnd=null;selectedCue=id;tool='select';stagePhase=phase;
 if(!keepSelection)selected=[];
 const e=selectedEvent();if(!e)return;if(!keepTime)positionMusicCursor(e.start);
 inspect=selected.length===1?{type:'entity',id:selected[0]}:{type:'cue',id};renderAll();
}
function renderEditorBar(){
 const e=selectedEvent(),list=C.events(song()),index=list.findIndex(x=>x.cue.id===selectedCue);
 $('#entityPicker').parentElement.classList.toggle('hidden',rehearsal);
 $('#entityPicker').innerHTML=tr('<option value="">选择角色或道具…</option>')+activeEntities().map(en=>`<option value="${esc(en.id)}" ${selected.length===1&&selected[0]===en.id?'selected':''}>${esc(en.label)} · ${esc(en.name)}</option>`).join('');
 $('#editStepBar').classList.toggle('rehearsal-controls',rehearsal);
 $('#stepPicker').innerHTML=tr('<option value="">起始站位 · 走台开始前</option>')+list.map((x,i)=>`<option value="${esc(x.cue.id)}" ${tool!=='initial'&&x.cue.id===selectedCue?'selected':''}>${String(i+1).padStart(2,'0')} · ${esc(x.cue.title)}</option>`).join('');
 if(tool==='initial')$('#stepPicker').value='';
 $('#initialStep').classList.toggle('selected',tool==='initial');$('#stepPrevious').disabled=tool==='initial';$('#stepNext').disabled=!list.length||(tool!=='initial'&&index>=list.length-1);
 $('#deleteStepButton').disabled=!e||tool==='initial'||rehearsal;$('#deleteStepButton').classList.toggle('hidden',rehearsal);
 $('#addStepButton').textContent=tr('＋ 添加动作');$('#addStepButton').title=ui`在播放指针 ${fmt(current)} 添加动作（N）`;$('#timelineAddCue').classList.toggle('hidden',rehearsal);
 $('#stepTimeRange').textContent=e&&tool!=='initial'?`${fmt(e.start)} → ${fmt(C.cuePlaybackEnd(e))}`:'';
 $('#stepStart').disabled=!e||tool==='initial';$('#stepEnd').disabled=!e||tool==='initial';$('#previewStep').disabled=!e||tool==='initial';
 $('#stepStart').classList.toggle('selected',stagePhase==='start'&&tool!=='initial');$('#stepEnd').classList.toggle('selected',stagePhase==='end'&&tool!=='initial');
 $('#stepDetailsButton').disabled=rehearsal;$('#stepDetailsButton').classList.toggle('hidden',rehearsal||inspect.type==='cue');
 $('#stepContext').textContent=tool==='initial'?tr('拖动演员摆好开场位置'):!e?tr('此处还没有动作'):stagePhase==='live'?ui`当前第 ${index+1} / ${list.length} 步`:stagePhase==='start'?tr('本步起点'):ui`第 ${index+1} / ${list.length} 步`;
 $('#ghostsToggle').checked=showGhosts;$('#snapToggle').checked=snapToGrid;$('#linkToggle').checked=linkNext;
 $('#pasteFormation').disabled=!formationClipboard;
 $('#stageViewBadge').textContent=playing?tr('正在预览'):tool==='initial'?tr('起始站位'):stagePhase==='end'?tr('本步落点'):stagePhase==='start'?tr('本步起点'):tr('播放位置');
 $('#stageViewBadge').classList.toggle('hidden',rehearsal);
}
function stepMiniature(cueId){
 const s=show(),all=[...C.flatten(s.stage.boundary),...s.stage.backstage.flatMap(z=>z.points)];
 const xs=all.map(p=>p.x),ys=all.map(p=>p.y),x=Math.min(...xs)-4,y=Math.min(...ys)-4,w=Math.max(...xs)-x+4,h=Math.max(...ys)-y+4;
 return `<svg viewBox="${x} ${y} ${w} ${h}" aria-hidden="true"><path d="${C.path(s.stage.boundary,true)}" fill="#e4dac2" stroke="#a58b5a" stroke-width="1"/>`+activeEntities().map(en=>{const p=C.cuePosition(song(),cueId,en.id);return p?`<circle cx="${p.x}" cy="${p.y}" r="2.9" fill="${safeColor(en.color)}"/>`:'';}).join('')+'</svg>';
}
function renderStepCards(){
 const list=C.events(song());$('#timelineHint').textContent=rehearsal?tr('点卡片查看这一步'):tr('点卡片选择步骤 · Delete 删除 · 右键更多操作');
 $('#bottomContent').innerHTML='<div class="stepcards"><button class="stepcard initial-card '+(tool==='initial'?'active':'')+tr('" data-action="tool-initial"><span class="stepcard-head"><b>开场</b></span><span class="stepcard-body">起始站位</span></button>')+list.map((e,i)=>ui`<button class="stepcard ${selectedCue===e.cue.id&&tool!=='initial'?'active':''}" data-human-step="${esc(e.cue.id)}" aria-label="编辑第 ${i+1} 步：${esc(e.cue.title)}" aria-pressed="${selectedCue===e.cue.id&&tool!=='initial'}"><span class="stepcard-head"><b>${String(i+1).padStart(2,'0')}</b><small>${e.duration} 秒 · ${e.cue.moves.length} 条行动</small></span><span class="stepcard-body">${stepMiniature(e.cue.id)}<span>${esc(e.cue.title)}</span></span></button>`).join('')+ui`<button class="stepcard add-step-card" data-action="human-next-step"><span>＋</span><b>在播放指针处添加</b><small>从上一步的站位继续</small></button></div>`;
 if(rehearsal)$$('.initial-card,.add-step-card').forEach(card=>card.remove());
 if(selectedCue){const card=$$('[data-human-step]').find(n=>n.dataset.humanStep===selectedCue);if(card){const parent=$('#bottomContent');if(card.offsetLeft<parent.scrollLeft||card.offsetLeft+card.offsetWidth>parent.scrollLeft+parent.clientWidth)parent.scrollLeft=Math.max(0,card.offsetLeft-20);}}
}
function humanPositionFields(p){const label=tool==='initial'?tr('起始'):tr('落点');return `<div class="two"><label class="field"><span>${label} X</span><input type="number" step="0.1" data-human-coordinate="x" value="${prettyCoordinate(p?.x??0)}"></label><label class="field"><span>${label} Y</span><input type="number" step="0.1" data-human-coordinate="y" value="${prettyCoordinate(p?.y??0)}"></label></div>`;}
function selectionTools(){return ui`<div class="selection-actions"><button data-action="human-align-horizontal">排成横排</button><button data-action="human-align-vertical">排成竖排</button><button data-action="human-space-horizontal" ${selected.length<3?'disabled':''}>横向等距</button><button data-action="human-space-vertical" ${selected.length<3?'disabled':''}>纵向等距</button></div><p class="footer-note">拖动其中一人，可整体移动。方向键微调；加 Shift 移动 5 格。</p>`;}
function renderHumanInspector(){
 if(rehearsal)return false;
 if(tool==='initial'&&inspect.type==='song'){
  $('#inspectorTitle').textContent=tr('起始站位');$('#inspector').innerHTML=tr('<div class="human-inspector-title"><h2>摆好开场位置</h2></div><p class="context-tip">拖动舞台上的演员，或从上方名单选择角色。准备好后，选择一个步骤继续编排。</p><button class="full" data-action="song-settings">曲目设置与笔记</button>');return true;
 }
 if(selected.length>1&&['entity','group'].includes(inspect.type)){
  $('#inspectorTitle').textContent=tr('多人编排');
  $('#inspector').innerHTML=ui`<div class="human-inspector-title"><h2>已选 ${selected.length} 个对象</h2><p>${selected.map(id=>esc(displayName(entity(id)))).join(' · ')}</p></div>${selectionTools()}<div class="row wrap"><button data-action="human-copy">复制这组站位</button><button data-action="human-clear">取消选择</button></div><label class="field"><span>给这组人写本步动作</span><textarea id="groupNote" placeholder="例如：同时看向 Hamilton，停住两拍。"></textarea></label><button data-action="human-group-note" class="gold full" ${!selectedCue?'disabled':''}>写入这 ${selected.length} 人的本步动作</button><p class="context-tip">每人都能在自己的本步动作里看到；各自已有备注会保留。</p>`;return true;
 }
 if(inspect.type!=='entity'||!activeEntities().some(en=>en.id===inspect.id))return false;
 const en=entity(inspect.id),isProp=show().props.some(p=>p.id===inspect.id),e=selectedEvent(),initial=tool==='initial',p=initial?song().initial[en.id]:e?C.cuePosition(song(),e.cue.id,en.id):viewPosition(en.id);
 const m=e?.cue.moves.find(m=>m.entityId===en.id),before=e?C.beforeCue(song(),e.cue.id,en.id):p;
 $('#inspectorTitle').textContent=initial?tr('起始站位与角色'):tr('本步行动');
 let html=`<div class="human-inspector-title"><span class="entitydot" style="background:${safeColor(en.color)}">${esc(en.label)}</span><h2>${esc(en.name)}</h2><p>${initial?tr('走台开始前的位置'):e?esc(e.cue.title):tr('先选择一个步骤')}</p></div>`;
 if(initial||e){
  html+=ui`<div class="movement-summary">${!initial?tr('落点 · '):''}${esc(stageRegion(p))}${!initial&&stagePhase!=='end'?tr('<button data-action="human-end">查看落点</button>'):''}</div><div class="nudge-controls"><span>微调</span><button data-action="human-nudge-left" aria-label="向画面左侧微调">←</button><button data-action="human-nudge-up" aria-label="向画面上方微调">↑</button><button data-action="human-nudge-down" aria-label="向画面下方微调">↓</button><button data-action="human-nudge-right" aria-label="向画面右侧微调">→</button></div>`;
  if(!initial&&m&&blockedRoute(m.points))html+=gateRouteFields(m);
  if(initial)html+=ui`<p class="context-tip">在舞台上拖动这个角色，设置开场位置。</p>`;
  if(!initial){html+=ui`<label class="field"><span>这一步怎么做</span><textarea aria-label="本步动作备注" data-human-note="${esc(en.id)}" data-human-cue="${esc(e.cue.id)}" placeholder="例如：慢慢走到中间，先看 Burr，再转向观众。">${esc(m?.notes||'')}</textarea></label>${linkedStepNotes(en.id,e)}${moveTimingFields(en,e,m)}<div class="route-choice"><button data-action="human-straight" class="${m&&!m.points.some(p=>p.c1)?'selected':''}">直走</button><button data-action="human-curve" class="${m?.points.some(p=>p.c1)?'selected':''}">绕弯</button><button data-action="human-route" ${!m?'disabled':''}>路径节点</button></div><p class="context-tip route-tip">拖演员改落点，拖线中间的圆点改弯度。</p>${m&&!blockedRoute(m.points)?gateRouteFields(m):''}<details class="advanced-details position-details"><summary>移到指定位置 / 更多</summary><button class="full" data-action="human-reset-move" ${!m?'disabled':''}>回到上一步的位置</button>`;}
  if(initial)html+=ui`<details class="advanced-details position-details"><summary>移到指定位置 / 更多</summary>`;
  html+=ui`<div class="zone-picker"><label class="field"><span>舞台区域 · 按观众视角</span><select id="stageZone">${stageZones().map(z=>`<option value="${z.key}">${z.name}</option>`).join('')}</select></label><button data-action="human-place" class="outline">移到这里</button></div><label class="field"><span>已有标记 / 出入口</span><select id="humanAnchor"><option value="">选择标记或出入口…</option>${show().stage.anchors.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label><details class="data-details"><summary>高级坐标与路径节点</summary>${humanPositionFields(p)}${!initial?tr('<button data-action="human-route" class="full">编辑路径节点</button>'):''}</details></details>`;
 }
 html+=ui`<details class="advanced-details"><summary>${tr(isProp?'道具资料与长期备注':'角色资料与长期备注')}</summary>${field(tr('角色／道具名称'),'name',en.name)}<div class="two">${field(tr('短标签'),'label',en.label)}${field(tr('颜色'),'color',en.color,'color')}</div><div class="two">${field(tr('起始 X'),'initial.x',song().initial[en.id]?.x,'number','step="0.1"')}${field(tr('起始 Y'),'initial.y',song().initial[en.id]?.y,'number','step="0.1"')}</div>${notesField(en)}<button class="danger full" data-action="delete-entity">从演出删除对象</button></details><button class="full" data-action="entity-records">${tr(isProp?'查看这个道具的全部记录':'查看这个角色的全部记录')}</button><p class="footer-note">Shift + 点击人物或框选空白区域，可选中多人。</p>`;
 $('#inspector').innerHTML=html;return true;
}
function editablePositions(){
 if(tool!=='initial'&&stagePhase!=='end'){pause();stagePhase='end';}
 if(tool!=='initial'&&!selectedEvent()){toast(tr('先选择一个步骤，或点「＋ 添加动作」。'));return null;}
 const positions={};for(const id of selected){const p=tool==='initial'?song().initial[id]:C.cuePosition(song(),selectedCue,id);if(p)positions[id]={x:p.x,y:p.y};}return positions;
}
function applyPositions(positions){
 if(tool==='initial')C.setInitialPositions(song(),positions,linkNext);else C.setDestinations(song(),selectedCue,positions,linkNext);
 stagePhase='end';changed();
}
function moveSelection(dx,dy){
 const positions=editablePositions();if(!positions||!Object.keys(positions).length)return;
 const a=-rotation*Math.PI/180,x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);
 snapshot();for(const p of Object.values(positions)){p.x=Math.round((p.x+x)*10)/10;p.y=Math.round((p.y+y)*10)/10;}applyPositions(positions);renderAll();
}
function alignSelection(kind){
 const positions=editablePositions();if(!positions||selected.length<2)return;
 const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),points=Object.entries(positions).map(([id,p])=>({id,x:p.x*c-p.y*s,y:p.x*s+p.y*c}));
 const horizontal=kind.endsWith('horizontal'),axis=kind.startsWith('space')?(horizontal?'x':'y'):(horizontal?'y':'x');
 if(kind.startsWith('space')){if(points.length<3)return;points.sort((a,b)=>a[axis]-b[axis]);const min=points[0][axis],max=points.at(-1)[axis];points.forEach((p,i)=>p[axis]=min+(max-min)*i/(points.length-1));}
 else{const average=points.reduce((n,p)=>n+p[axis],0)/points.length;points.forEach(p=>p[axis]=average);}
 for(const p of points)positions[p.id]={x:Math.round((p.x*c+p.y*s)*10)/10,y:Math.round((-p.x*s+p.y*c)*10)/10};
 snapshot();applyPositions(positions);renderAll();toast(tr('已调整站位；⌘Z 可撤销。'));
}
function createNextStep(){return createStepAt(current);}
function writeGroupActionNote(){
 const e=selectedEvent(),text=$('#groupNote')?.value.trim();if(!e||!text||selected.length<2)return;
 mutate(()=>{for(const id of selected){let move=e.cue.moves.find(m=>m.entityId===id);if(!move){C.setDestinations(song(),e.cue.id,{[id]:C.beforeCue(song(),e.cue.id,id)},linkNext);move=e.cue.moves.find(m=>m.entityId===id);}const blocks=(move.notes||'').split('\n\n');if(!blocks.includes(text))move.notes=[move.notes,text].filter(Boolean).join('\n\n');}});
 toast(ui`已写入 ${selected.length} 人的本步动作；切换到任一演员都能看到。`);
}
function linkedStepNotes(id,event){
 const notes=song().annotations.filter(a=>{const range=C.annotationRange(show(),song(),a);return !range.missing&&(!a.entityIds?.length||a.entityIds.includes(id))&&(range.start==null||range.start<=C.cuePlaybackEnd(event))&&(range.end==null||range.end>=event.start);});
 return notes.map(a=>ui`<div class="linked-step-note"><small>共同提醒</small><p>${esc(a.notes)}</p><button data-inspect="annotation" data-id="${esc(a.id)}">编辑这条提醒</button></div>`).join('');
}
function blockedRoute(points){
 const line=C.flatten(points),stage=show().stage;
 return line.some(p=>!C.allowed(p,stage))||stage.walls.some(w=>{const wall=C.flatten(w.points);return line.slice(1).some((p,i)=>wall.slice(1).some((b,j)=>C.crosses(line[i],p,wall[j],b)));});
}
function gateRouteOptions(move){
 if(!move||move.points.length<2)return [];
 const out=[];for(const gate of show().stage.anchors.filter(a=>a.kind==='gate')){
  for(let i=1;i<move.points.length;i++){
   const points=C.clone(move.points);delete points[i].c1;delete points[i].c2;points.splice(i,0,{x:gate.x,y:gate.y});
   if(blockedRoute(points))continue;const from=move.points[i-1],to=move.points[i],cost=Math.hypot(from.x-gate.x,from.y-gate.y)+Math.hypot(to.x-gate.x,to.y-gate.y)-Math.hypot(to.x-from.x,to.y-from.y);
   out.push({gate,points,cost});
  }
 }return out.sort((a,b)=>a.cost-b.cost);
}
function gateRouteFields(move){
 if(!move)return '';const gates=show().stage.anchors.filter(a=>a.kind==='gate');if(!gates.length)return '';
 const blocked=blockedRoute(move.points),options=gateRouteOptions(move),best=options[0];
 return ui`<details class="gate-route" ${blocked?'open':''}><summary>${blocked?tr('路线需绕过边墙'):tr('经过上下场口')}</summary>${blocked?tr('<p class="warning">直线会穿墙，可选择入口绕行。</p>'):''}<div class="gate-route-controls"><select id="routeGate" aria-label="路线经过出入口">${gates.map(g=>`<option value="${esc(g.id)}" ${g.id===best?.gate.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select><button data-action="human-via-gate">加入路线</button></div>${blocked&&!best?tr('<p class="context-tip">此路线需要多个经过点，请用「路径节点」调整。</p>'):''}</details>`;
}
function addGateToRoute(){
 const move=editedMove();if(!move)return;const gateId=$('#routeGate')?.value,option=gateRouteOptions(move).find(o=>o.gate.id===gateId);
 if(!option){toast(tr('经过这个入口仍会穿墙，请选其他入口，或在路径节点中添加多个经过点。'));return;}
 mutate(()=>{move.points=option.points;},false);stagePhase='end';renderAll();toast(ui`路线已经过${option.gate.name}；起点、落点和播放位置保持不变。`);
}
let stageFocusPrevious=null,timelineHeightPrevious=null;
function updateLayoutControls(){
 const focus=$('#workspace').classList.contains('stage-focus');$('#stageFocusButton').textContent=focus?tr('还原布局'):tr('放大舞台');$('#stageFocusButton').setAttribute('aria-pressed',String(focus));
 $('#timelineHeightButton').textContent=timelineHeightPrevious===null?tr('展开时间轴'):tr('收起时间轴');
}
function toggleStageFocus(){
 const style=document.documentElement.style,workspace=$('#workspace'),enter=!workspace.classList.contains('stage-focus');
 if(enter){stageFocusPrevious=style.getPropertyValue('--bottom');style.setProperty('--bottom','160px');}else{if(stageFocusPrevious)style.setProperty('--bottom',stageFocusPrevious);else style.removeProperty('--bottom');stageFocusPrevious=null;}
 timelineHeightPrevious=null;workspace.classList.toggle('stage-focus',enter);updateLayoutControls();renderStage();if(bottomTab==='timeline')renderTimeline();
}
function toggleTimelineHeight(){
 const style=document.documentElement.style;if(timelineHeightPrevious===null){timelineHeightPrevious=style.getPropertyValue('--bottom');style.setProperty('--bottom',Math.min(340,Math.round(window.innerHeight*.43))+'px');}else{if(timelineHeightPrevious)style.setProperty('--bottom',timelineHeightPrevious);else style.removeProperty('--bottom');timelineHeightPrevious=null;}
 bottomTab='timeline';updateLayoutControls();renderStage();renderBottom();
}
function parsePlaybackTime(text){
 const value=String(text).trim();if(/^\d+(?:\.\d+)?$/.test(value))return +value;
 const m=value.match(/^(\d+):([0-5]?\d(?:\.\d+)?)$/);return m?+m[1]*60 + +m[2]:null;
}
function goToTimeDialog(){
 pause();modal(tr('定位播放时间'),ui`<form id="seekForm"><label class="field"><span>分:秒，或直接输入秒数</span><input id="seekTime" aria-label="要定位的播放时间" value="${fmt(current)}" placeholder="01:25.6" inputmode="decimal"></label><p id="seekError" class="warning" role="status"></p><div class="dialogactions"><button type="button" id="seekCancel">取消</button><button type="submit" class="gold">定位</button></div></form>`);
 $('#seekCancel').onclick=closeModal;$('#seekForm').onsubmit=e=>{e.preventDefault();const t=parsePlaybackTime($('#seekTime').value);if(t===null||!Number.isFinite(t)||t>86400){$('#seekError').textContent=tr('请输入 0 到 24 小时之间的时间。');return;}singleStepEnd=null;closeModal();seek(t);revealTimelineCursor();};$('#seekTime').focus();$('#seekTime').select();
}

async function humanAction(a){
 if(!a.startsWith('human-'))return false;
 const e=selectedEvent();
 switch(a){
 case 'human-step-details':selected=[];inspect={type:e&&tool!=='initial'?'cue':'song',id:e&&tool!=='initial'?e.cue.id:songId};renderAll();break;
 case 'human-left':$('#workspace').classList.toggle('show-left');break;
 case 'human-right':$('#workspace').classList.toggle('show-right');break;
 case 'human-prev':{const list=C.events(song()),i=list.findIndex(x=>x.cue.id===selectedCue);if(i>0)chooseStep(list[i-1].cue.id);else{pause();tool='initial';current=0;selected=[];inspect={type:'song',id:songId};renderAll();}break;}
 case 'human-next':{const list=C.events(song()),i=tool==='initial'?-1:list.findIndex(x=>x.cue.id===selectedCue);if(list[i+1])chooseStep(list[i+1].cue.id);break;}
 case 'human-start':case 'human-end':if(e){pause();stagePhase=a==='human-start'?'start':'end';renderAll();}break;
 case 'human-preview':if(e){pause();stagePhase='live';singleStepEnd=C.cuePlaybackEnd(e);seek(e.start);renderEditorBar();await play(true);}break;
 case 'human-next-step':createNextStep();break;
 case 'human-copy':{const ids=selected.length?selected:activeEntities().map(en=>en.id);formationClipboard={};for(const id of ids){const p=viewPosition(id);if(p)formationClipboard[id]={x:p.x,y:p.y};}renderEditorBar();toast(tr('已复制 ')+Object.keys(formationClipboard).length+tr(' 个对象的站位，可切换步骤后粘贴。'));break;}
 case 'human-paste':{if(!formationClipboard)break;const ids=new Set(activeEntities().map(en=>en.id)),positions=Object.fromEntries(Object.entries(formationClipboard).filter(([id])=>ids.has(id)));if(!Object.keys(positions).length){toast(tr('本曲目没有相同的角色／道具。'));break;}if(tool!=='initial'&&!e){toast(tr('先选择一个走台步骤。'));break;}snapshot();applyPositions(positions);selected=Object.keys(positions);inspect={type:selected.length>1?'group':'entity',id:selected[0]};renderAll();toast(tr('已粘贴站位，角色备注保持原样。'));break;}
 case 'human-clear':selected=[];inspect={type:e?'cue':'song',id:e?.cue.id||songId};renderAll();break;
 case 'human-align-horizontal':case 'human-align-vertical':case 'human-space-horizontal':case 'human-space-vertical':alignSelection(a.slice(6));break;
 case 'human-group-note':writeGroupActionNote();break;
 case 'human-via-gate':addGateToRoute();break;
 case 'human-place':{const key=$('#stageZone')?.value,zone=stageZones().find(z=>z.key===key);if(!zone||selected.length!==1)break;const pos=editablePositions();if(!pos)break;pos[selected[0]]={x:zone.x,y:zone.y};snapshot();applyPositions(pos);renderAll();break;}
 case 'human-nudge-left':case 'human-nudge-right':case 'human-nudge-up':case 'human-nudge-down':{const boundary=C.flatten(show().stage.boundary),span=Math.max(...boundary.map(p=>p.x))-Math.min(...boundary.map(p=>p.x)),n=Math.max(.1,span/120);moveSelection(a.endsWith('left')?-n:a.endsWith('right')?n:0,a.endsWith('up')?-n:a.endsWith('down')?n:0);break;}
 case 'human-route':case 'human-straight':case 'human-curve':{
  if(!e||selected.length!==1)break;const id=selected[0];let m=e.cue.moves.find(m=>m.entityId===id);
  if(a==='human-route'){if(m)inspectObject('move',m.id);break;}
  snapshot();if(!m){const p=C.beforeCue(song(),e.cue.id,id);C.setDestinations(song(),e.cue.id,{[id]:p},linkNext);m=e.cue.moves.find(m=>m.entityId===id);}
  for(let i=1;i<m.points.length;i++){const b=m.points[i],from=m.points[i-1];if(a==='human-straight'){delete b.c1;delete b.c2;}else{const dx=b.x-from.x,dy=b.y-from.y;b.c1={x:from.x+dx/3-dy*.2,y:from.y+dy/3+dx*.2};b.c2={x:from.x+dx*2/3-dy*.2,y:from.y+dy*2/3+dx*.2};}}
  stagePhase='end';changed();inspect={type:'entity',id};renderAll();break;
 }
 case 'human-reset-move':{if(!e||selected.length!==1)break;const id=selected[0],m=e.cue.moves.find(m=>m.entityId===id);if(!m)break;snapshot();const p=C.beforeCue(song(),e.cue.id,id);C.setDestinations(song(),e.cue.id,{[id]:p},linkNext);m.points=[{...p},{...p}];changed();renderAll();break;}
 case 'human-tour':modal(tr('三分钟开始手动编排'),ui`<ol class="quickstart"><li><b>摆好起始站位</b><p>点击舞台上方「起始站位」，把人物拖到开场的位置。</p></li><li><b>选一步，摆落点</b><p>点击下方步骤卡片。圆点是这一步结束的位置；淡色小圈是起点。拖动要移动的人即可。</p></li><li><b>选人物，写动作</b><p>右侧填写本步动作；拖路线圆点改弯度。「路径节点」中可添加、删除经过点。</p></li><li><b>排多人，接下一步</b><p>Shift + 点击或框选多人，整体拖动、对齐或等距排列。先定位音乐，再点「＋ 添加动作」；已有步骤的时间保持不变。</p></li><li><b>预览，然后保存</b><p>「预览本步」到达后会停下。⌘Z 撤销，⌘S 保存；导出演出包即可发给其他人。</p></li></ol><p class="footer-note">时间轴、歌词、全局检索、演员排练和 AI 编辑入口均保留。右键步骤、演员或路径可打开常用操作；按 ? 查看快捷键。</p>`);break;
 }
 return true;
}
document.addEventListener('click',e=>{const card=e.target.closest('[data-human-step]');if(card)chooseStep(card.dataset.humanStep,'end',false);});
document.addEventListener('input',e=>{
 const input=e.target;
 if(input.matches('[data-human-coordinate]')){
  const positions=editablePositions();if(!positions||selected.length!==1||input.value===''||!Number.isFinite(+input.value))return;
  if(!humanLiveFields.has(input)){snapshot();humanLiveFields.add(input);}
  positions[selected[0]][input.dataset.humanCoordinate]=+input.value;applyPositions(positions);renderStage();renderBottom();updateTransport();renderEditorBar();
  const summary=$('#inspector .movement-summary'),p=positions[selected[0]],before=C.beforeCue(song(),selectedCue,selected[0]);
  if(summary&&before)summary.textContent=Math.hypot(before.x-p.x,before.y-p.y)>.1?tr('移动到新位置'):tr('留在原地');
  return;
 }
 if(!input.matches('[data-human-note]'))return;
 const cue=song().cues.find(c=>c.id===input.dataset.humanCue),id=input.dataset.humanNote;if(!cue)return;
 if(!humanLiveFields.has(input)){snapshot();humanLiveFields.add(input);}
 let m=cue.moves.find(m=>m.entityId===id);if(!m){C.setDestinations(song(),cue.id,{[id]:C.beforeCue(song(),cue.id,id)},linkNext);m=cue.moves.find(m=>m.entityId===id);}m.notes=input.value;changed();
});
document.addEventListener('change',e=>{
 const input=e.target;
 if(input.id==='stepPicker'){if(input.value)chooseStep(input.value);else{pause();tool='initial';current=0;selected=[];inspect={type:'song',id:songId};renderAll();}}
 else if(input.id==='entityPicker'){if(input.value)inspectObject('entity',input.value);else{selected=[];syncPlaybackContext();inspect={type:selectedCue?'cue':'song',id:selectedCue||songId};renderAll();}}
 else if(input.id==='ghostsToggle'){showGhosts=input.checked;renderStage();}
 else if(input.id==='snapToggle')snapToGrid=input.checked;
 else if(input.id==='linkToggle')linkNext=input.checked;
 else if(input.matches('[data-human-note]')){humanLiveFields.delete(input);renderBottom();}
 else if(input.matches('[data-human-coordinate]')){humanLiveFields.delete(input);}
 else if(input.id==='humanAnchor'&&input.value){const anchor=show().stage.anchors.find(a=>a.id===input.value);if(!anchor||selected.length!==1)return;const positions=editablePositions();if(!positions)return;positions[selected[0]]={x:anchor.x,y:anchor.y};snapshot();applyPositions(positions);renderAll();}
});
document.addEventListener('focusout',e=>{if(e.target.matches('[data-human-coordinate],[data-human-note]'))humanLiveFields.delete(e.target);});
function pauseForEditing(e){if((playing||countdownTimer)&&e.target.matches('[data-field],[data-human-note],[data-human-coordinate],[data-move-time],[data-lyric-inline],#groupNote'))pause();}
document.addEventListener('pointerdown',pauseForEditing,true);
document.addEventListener('focusin',pauseForEditing);

function audienceSpace(p,inverse=false){
 const side=show().stage.audience||'south';
 if(side==='north')return{x:-p.x,y:-p.y};
 if(side==='east')return inverse?{x:p.y,y:-p.x}:{x:-p.y,y:p.x};
 if(side==='west')return inverse?{x:-p.y,y:p.x}:{x:p.y,y:-p.x};
 return{x:p.x,y:p.y};
}
function stageFrame(){
 const poly=C.flatten(show().stage.boundary,true),points=poly.map(p=>audienceSpace(p));
 return{poly,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
}
function stageRegion(p){
 if(!p)returntr('尚未摆位');
 const f=stageFrame();if(!C.inside(p,f.poly)){const back=show().stage.backstage.find(z=>C.inside(p,C.flatten(z.points,true)));return back?.name||tr('舞台外');}
 const v=audienceSpace(p),x=(v.x-f.minX)/(f.maxX-f.minX||1),y=(v.y-f.minY)/(f.maxY-f.minY||1);
 const row=Math.max(0,Math.min(2,Math.floor(y*3))),col=Math.max(0,Math.min(2,Math.floor(x*3)));return (row===1&&col===1?tr('舞台中心'):[tr('后'),tr('中'),tr('前')][row]+(typeof StageI18n!=='undefined'&&StageI18n.language==='en'?' ':'')+[tr('左'),tr('中'),tr('右')][col])+tr(' · 观众视角');
}
function stageZones(){
 const f=stageFrame(),zones=[];
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  let p=audienceSpace({x:f.minX+(f.maxX-f.minX)*[.24,.5,.76][col],y:f.minY+(f.maxY-f.minY)*[.22,.5,.78][row]},true);
  if(!C.inside(p,f.poly)){let best=null,d=Infinity;for(let a=1;a<20;a++)for(let b=1;b<20;b++){const q=audienceSpace({x:f.minX+(f.maxX-f.minX)*a/20,y:f.minY+(f.maxY-f.minY)*b/20},true),dist=Math.hypot(q.x-p.x,q.y-p.y);if(dist<d&&C.inside(q,f.poly)){best=q;d=dist;}}if(!best)continue;p=best;}
  zones.push({key:row+'-'+col,name:row===1&&col===1?tr('舞台中心'):[tr('后'),tr('中'),tr('前')][row]+(typeof StageI18n!=='undefined'&&StageI18n.language==='en'?' ':'')+[tr('左'),tr('中'),tr('右')][col],...p});
 }return zones;
}
