/* Contextual editing commands, route-point selection and keyboard shortcuts. */
let selectedRouteNode=null,contextMenuData=null,menuReturnFocus=null;
function isTypingTarget(target){return !!target&&(!!target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(String(target.tagName||'').toUpperCase())||!!target.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'));}
function editedMove(){return inspect.type==='move'?song()?.cues.flatMap(c=>c.moves).find(m=>m.id===inspect.id):selected.length===1?selectedEvent()?.cue.moves.find(m=>m.entityId===selected[0]):null;}
function routeNode(){
 const n=selectedRouteNode,m=editedMove();
 if(!n||n.songId!==songId||inspect.type!=='move'||!m||m.id!==n.moveId||!m.points[n.index]||(n.key!=='point'&&!C.point(m.points[n.index][n.key]))){selectedRouteNode=null;return null;}
 return n;
}
function syncRouteSelection(){routeNode();}
function nodeName(index,length){return index===0?tr('起点'):index===length-1?tr('终点'):ui`经过点 ${index}`;}
function selectRouteHandle(value,render=true){
 const m=editedMove(),[raw,key]=String(value).split(':'),index=Number(raw);if(!m||!Number.isInteger(index)||!m.points[index]||!['point','c1','c2'].includes(key))return;
 selectedRouteNode={songId,moveId:m.id,index,key};if(render){renderStage();renderInspector();renderEditorBar();}
}
function routeHandlesHTML(m,scale){
 const selectedNode=routeNode(),r=Math.max(1.1,5.5/scale);let html='';
 m.points.forEach((p,i)=>{
  for(const key of ['c1','c2'])if(C.point(p[key])){const from=key==='c1'?m.points[i-1]:p,active=selectedNode?.index===i&&selectedNode.key===key;if(from)html+=ui`<path d="M ${from.x} ${from.y} L ${p[key].x} ${p[key].y}" stroke="#8f7860" stroke-width=".3"/><circle cx="${p[key].x}" cy="${p[key].y}" r="${r*.75}" fill="${active?'#c37c33':'#f1d58b'}" stroke="#8e7448" stroke-width=".4" data-handle="${i}:${key}" tabindex="0" role="button" aria-label="弯度控制点 ${i}-${key}，Delete 恢复直线" class="object-control"><title>弯度控制点 · Delete 恢复直线</title></circle>`;}
  const active=selectedNode?.index===i&&selectedNode.key==='point',label=nodeName(i,m.points.length);
  html+=`<g data-handle="${i}:point" tabindex="0" role="button" aria-label="${label}${i>0&&i<m.points.length-1?tr('，可用 Delete 删除'):tr('，保留端点')}" class="object-control"><circle cx="${p.x}" cy="${p.y}" r="${r*1.7}" fill="transparent"/><rect x="${p.x-r}" y="${p.y-r}" width="${r*2}" height="${r*2}" rx=".3" fill="${active?'#d79b45':'#fff9e7'}" stroke="${active?'#3b2811':'#675538'}" stroke-width="${active?.8:.4}"/><title>${label}${i>0&&i<m.points.length-1?tr(' · Delete 删除'):tr(' · 保留端点')}</title></g>`;
 });return html;
}
function pathInspectorHTML(m){
 const n=routeNode(),removable=n&&(n.key!=='point'||n.index>0&&n.index<m.points.length-1);
 return ui`<div class="human-inspector-title"><h2>${esc(displayName(entity(m.entityId)))}</h2><p>路径节点 · ${m.points.length} 个</p></div>${gateRouteFields(m)}<div class="path-edit-toolbar"><button data-action="edit-insert-node">＋ 经过点</button><button data-action="edit-finish-path">完成编辑</button></div><p class="context-tip">点击经过点，再按 Delete 删除。也可右键路线添加节点；起点与终点保留。</p><button class="full node-delete-button" data-action="edit-delete-node" ${removable?'':'disabled'}>${n?.key&&n.key!=='point'?tr('清除选中弯度'):tr('删除选中经过点')} <kbd>Delete</kbd></button>`+m.points.map((p,i)=>ui`<section class="route-node-row ${n?.index===i?'active':''}"><div class="route-node-heading"><button data-action="edit-node-select:${i}">${nodeName(i,m.points.length)}</button>${i>0&&i<m.points.length-1?ui`<button data-action="edit-node-delete:${i}" class="danger" aria-label="删除经过点 ${i}">删除</button>`:tr('<span class="fixed-node-label">端点</span>')}</div><p>${esc(stageRegion(p))}</p><details class="node-coordinates"><summary>精确坐标</summary><div class="two">${field('X',`points.${i}.x`,p.x,'number','step="0.1"')}${field('Y',`points.${i}.y`,p.y,'number','step="0.1"')}</div></details></section>`).join('')+ui`<div class="row wrap"><button data-action="route-straight">整条改直线</button><button data-action="route-curve">整条改曲线</button></div>${notesField(m)}<button class="danger full" data-action="edit-delete-movement">删除本步这次行动</button>`;
}
function canEdit(){if(rehearsal){toast(tr('切换到「编排」后再编辑。'));return false;}return true;}
function deleteCurrentStep(){
 if(!canEdit())return;const q=song(),cue=q?.cues.find(c=>c.id===selectedCue);if(!cue||tool==='initial'){toast(tr('先选择要删除的步骤。'));return;}
 pause();singleStepEnd=null;const index=q.cues.indexOf(cue),name=cue.title;mutate(()=>C.removeActions(q,cue.id,null,linkNext),false);selected=[];selectedRouteNode=null;selectedCue=q.cues[Math.min(index,q.cues.length-1)]?.id||null;prepareHumanSceneAfterDelete();toast(ui`已删除「${name}」；⌘ / Ctrl + Z 可撤销。`);
}
function duplicateCurrentStep(){
 if(!canEdit())return;const q=song(),cue=q?.cues.find(c=>c.id===selectedCue);if(!cue||tool==='initial')return toast(tr('先选择一个步骤。'));
 const copy=C.clone(cue);copy.id=C.id('cue');copy.title+=tr(' · 副本');copy.at+=copy.duration;copy.moves.forEach(m=>m.id=C.id('move'));mutate(()=>q.cues.splice(q.cues.indexOf(cue)+1,0,copy),false);chooseStep(copy.id,'end',false);toast(tr('已复制步骤；可继续调整时间或站位。'));
}
function reorderCurrentStep(direction){
 if(!canEdit())return;const q=song(),index=q.cues.findIndex(c=>c.id===selectedCue),to=index+direction;if(index<0||to<0||to>=q.cues.length)return;
 mutate(()=>{const [cue]=q.cues.splice(index,1);q.cues.splice(to,0,cue);});
}
function deleteSelectedRouteNode(){
 if(!canEdit())return;const n=routeNode(),m=editedMove();if(!n||!m)return toast(tr('先点选一个路径经过点。'));
 if(n.key==='point'&&(n.index===0||n.index===m.points.length-1))return toast(tr('起点和终点保留；可删除中间经过点，或删除本步整次行动。'));
 if(n.key!=='point'){mutate(()=>{delete m.points[n.index].c1;delete m.points[n.index].c2;},false);selectedRouteNode={...n,key:'point'};renderAll();toast(tr('已清除这段弯度，恢复直线。'));return;}
 mutate(()=>C.removeRoutePoint(m.points,n.index),false);selectedRouteNode={...n,index:Math.min(n.index,m.points.length-2),key:'point'};renderAll();toast(tr('已删除经过点并连接前后两点；可撤销。'));
}
function insertSelectedRoutePoint(context=null){
 if(!canEdit())return;const m=editedMove();if(!m)return toast(tr('先选择一个有路线的演员。'));
 const n=routeNode(),use=context?.moveId===m.id&&context.segment>0&&context.segment<m.points.length,segment=use?context.segment:Math.min(m.points.length-1,n?n.index+1:m.points.length-1),t=use?context.t:.5;let index;
 mutate(()=>{index=C.insertRoutePoint(m.points,segment,t);},false);if(index<0)return;inspect={type:'move',id:m.id};selected=[m.entityId];selectedRouteNode={songId,moveId:m.id,index,key:'point'};renderAll();toast(tr('已添加经过点，直接拖动它改路线。'));
}
function deleteSelectedMovement(){
 if(!canEdit())return;const e=selectedEvent();if(!e||tool==='initial')return toast(tr('先选择一个走台步骤。'));
 const ids=inspect.type==='move'&&editedMove()?[editedMove().entityId]:[...selected];if(!ids.length)return toast(tr('先选择演员或行动色条。'));
 const removed=e.cue.moves.filter(m=>ids.includes(m.entityId));if(!removed.length)return toast(tr('这些演员在本步没有行动可删除。'));
 mutate(()=>C.removeActions(song(),e.cue.id,ids,linkNext),false);selectedRouteNode=null;inspect={type:selected.length>1?'group':'entity',id:ids[0]};selected=ids;renderAll();toast(ui`已取消 ${removed.length} 个本步行动；角色名单保留，可撤销。`);
}
function deleteSelection(){
 if(!canEdit())return;
 if(routeNode())return deleteSelectedRouteNode();
 if(inspect.type==='move')return toast(tr('先点选经过点再删除；删除整次行动请用右键菜单。'));
 if(['lyric','annotation'].includes(inspect.type))return runEditingCommand('delete-'+inspect.type);
 if(['anchor','wall','backstage'].includes(inspect.type))return runEditingCommand('delete-stage-object');
 if(selected.length)return deleteSelectedMovement();return deleteCurrentStep();
}
function finishPathEditing(){const m=editedMove();selectedRouteNode=null;if(m){selected=[m.entityId];inspect={type:'entity',id:m.entityId};}renderAll();}
function selectAllActors(){selected=activeEntities().map(e=>e.id);selectedRouteNode=null;inspect={type:selected.length>1?'group':selected.length?'entity':'cue',id:selected[0]||selectedCue};renderAll();}
function nudgePathNode(dx,dy){
 const n=routeNode(),m=editedMove();if(!n||!m)return;const angle=-rotation*Math.PI/180,x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
 mutate(()=>{const p=m.points[n.index],dest=n.key==='point'?p:p[n.key];dest.x=prettyCoordinate(dest.x+x);dest.y=prettyCoordinate(dest.y+y);if(n.key==='point'){if(p.c2){p.c2.x+=x;p.c2.y+=y;}if(m.points[n.index+1]?.c1){m.points[n.index+1].c1.x+=x;m.points[n.index+1].c1.y+=y;}}});
}
function openPathEditor(){
 if(!canEdit())return;const m=editedMove();if(!m)return toast(tr('这个演员在本步还没有路线，先拖动演员摆位。'));inspectObject('move',m.id);selectedRouteNode=null;renderAll();
}
function renameCurrentStep(){if(!canEdit()||!selectedEvent()||tool==='initial')return;selected=[];selectedRouteNode=null;inspect={type:'cue',id:selectedCue};renderAll();const input=$('#inspector [data-field="title"]');input?.focus();input?.select();}
function createStepAt(time){
 if(!canEdit()||!C.finite(time))return;
 pause();singleStepEnd=null;const q=song(),converted=q.mode==='steps',cue={id:C.id('cue'),title:tr('新的一步'),at:Math.max(0,timeRound(time)),duration:4,stopAfter:true,notes:'',moves:[]};
 mutate(()=>{
  if(converted){for(const e of C.events(q))e.cue.at=e.start;q.mode='timed';}
  const index=q.cues.findIndex(c=>c.at>cue.at);q.cues.splice(index<0?q.cues.length:index,0,cue);
 },false);
 selectedCue=cue.id;selected=[];selectedRouteNode=null;tool='select';stagePhase='end';positionMusicCursor(cue.at);inspect={type:'cue',id:cue.id};renderAll();
 const input=$('#inspector [data-field="title"]');input?.focus();input?.select();
 toast(ui`已在 ${fmt(cue.at)} 添加动作${converted?tr('，原有动作的时间保持不变'):''}。`);return cue;
}
function shortcutsDialog(){
 const groups=[[tr('播放与步骤'),[[tr('空格'),tr('播放 / 暂停')],[tr('Shift + 空格'),tr('预览当前一步')],[tr('[ / ] 或 PageUp / PageDown'),tr('上一步 / 下一步')],['Home / End',tr('第一步 / 最后一步')],['N',tr('在当前播放指针处添加动作，保留当前视图')],['⌘ / Ctrl + D',tr('复制当前步骤')],['F2',tr('重命名当前步骤')]]],[tr('选择与编辑'),[['Delete / Backspace',tr('删除选中的步骤、节点或本步行动')],[tr('方向键'),tr('微调选中的演员或节点；未选演员时左右切步骤')],[tr('Shift + 方向键'),tr('加大微调幅度')],['⌘ / Ctrl + A',tr('全选本曲目的演员与道具')],['⌘ / Ctrl + C / V',tr('复制 / 粘贴站位')],['E / V',tr('路径节点编辑 / 返回摆位')],['Esc',tr('关闭右键菜单或逐级取消选择')]]],[tr('时间轴与文件'),[[tr('时间轴色条上的 ← / →'),tr('前后移动 0.1 秒；Shift 为 1 秒')],['+ / − / 0',tr('放大 / 缩小 / 适配当前视图')],['⌘ / Ctrl + Z',tr('撤销')],[tr('⌘ / Ctrl + Shift + Z 或 Ctrl + Y'),tr('重做')],['⌘ / Ctrl + S / O / K',tr('保存 / 导入 / 搜索')],['?',tr('打开本表')]]]];
 modal(tr('快捷键与右键菜单'),ui`<p class="context-tip">输入框内保留正常打字、删除、复制粘贴与文字撤销。右键步骤、演员、路线或经过点，会显示对应操作。</p>`+groups.map(([title,rows])=>`<h3>${title}</h3><table class="shortcut-table"><tbody>${rows.map(([key,text])=>`<tr><td><kbd>${esc(key)}</kbd></td><td>${esc(text)}</td></tr>`).join('')}</tbody></table>`).join(''));
}
async function editingAction(a){
 if(!a.startsWith('edit-'))return false;
 if(a.startsWith('edit-node-select:')){selectRouteHandle(a.split(':')[1]+':point');return true;}
 if(a.startsWith('edit-node-delete:')){selectRouteHandle(a.split(':')[1]+':point',false);deleteSelectedRouteNode();return true;}
 switch(a){
 case 'edit-shortcuts':shortcutsDialog();break;
 case 'edit-delete-step':deleteCurrentStep();break;
 case 'edit-duplicate-step':duplicateCurrentStep();break;
 case 'edit-delete-selection':deleteSelection();break;
 case 'edit-delete-node':deleteSelectedRouteNode();break;
 case 'edit-insert-node':insertSelectedRoutePoint();break;
 case 'edit-insert-node-here':insertSelectedRoutePoint(contextMenuData);break;
 case 'edit-delete-movement':deleteSelectedMovement();break;
 case 'edit-path':openPathEditor();break;
 case 'edit-finish-path':finishPathEditing();break;
 case 'edit-select-all':selectAllActors();break;
 case 'edit-rename-step':renameCurrentStep();break;
 case 'edit-step-details':selected=[];selectedRouteNode=null;inspect={type:'cue',id:selectedCue};renderAll();break;
 case 'edit-actor-details':{const m=editedMove();selectedRouteNode=null;if(m){selected=[m.entityId];inspect={type:'entity',id:m.entityId};}renderAll();break;}
 case 'edit-timing':{const m=editedMove();if(m){selected=[m.entityId];inspect={type:'entity',id:m.entityId};}selectedRouteNode=null;renderAll();$('#inspector [data-move-time="duration"]')?.focus();break;}
 case 'edit-step-here':createStepAt(contextMenuData?.time??current);break;
 case 'edit-play-here':pause();seek(contextMenuData?.time??current);singleStepEnd=null;await play(true);break;
 case 'edit-seek-here':pause();seek(contextMenuData?.time??current);break;
 }return true;
}
function runEditingCommand(a){Promise.resolve(action(a)).catch(e=>{console.error(e);toast(e.message||tr('操作失败'));});}
function closeContextMenu(restore=false){const menu=$('#contextMenu');menu.classList.add('hidden');menu.setAttribute('aria-hidden','true');if(restore)menuReturnFocus?.focus?.({preventScroll:true});}
function contextMenuOpen(){return $('#contextMenu').getAttribute('aria-hidden')==='false';}
function menuItem(label,action,key='',disabled=false){return{label,action,key,disabled};}
function showContextMenu(title,items,x,y,data={}){
 const menu=$('#contextMenu');contextMenuData=data;menuReturnFocus=document.activeElement;
 menu.innerHTML=`<div class="context-menu-title">${esc(title)}</div>`+items.map(item=>item===null?'<hr role="separator">':`<button type="button" role="menuitem" data-action="${esc(item.action)}" ${item.disabled?'disabled':''}><span>${esc(item.label)}</span>${item.key?`<kbd>${esc(item.key)}</kbd>`:''}</button>`).join('');
 menu.classList.remove('hidden');menu.setAttribute('aria-hidden','false');const width=menu.offsetWidth||260,height=menu.offsetHeight||items.length*35+36;
 menu.style.left=Math.max(8,Math.min(x,window.innerWidth-width-8))+'px';menu.style.top=Math.max(8,Math.min(y,window.innerHeight-height-8))+'px';menu.querySelector?.('button:not(:disabled)')?.focus({preventScroll:true});
}
function stepMenu(){return[menuItem(tr('预览本步'),'human-preview',tr('Shift 空格')),menuItem(tr('重命名'),'edit-rename-step','F2'),menuItem(tr('复制步骤'),'edit-duplicate-step','⌘/Ctrl D'),menuItem(song().mode==='timed'?tr('在当前时间添加动作'):tr('在后面加一步'),'human-next-step','N'),menuItem(tr('前移一步'),'cue-up'),menuItem(tr('后移一步'),'cue-down'),null,menuItem(tr('删除本步'),'edit-delete-step','Delete')];}
function rehearsalMenu(){return[menuItem(tr('播放 / 暂停'),'play',tr('空格')),menuItem(tr('上一步'),'previous','['),menuItem(tr('下一步'),'next',']'),menuItem(tr('快捷键'),'edit-shortcuts','?')];}
function actorMenu(){const m=editedMove();return[menuItem(tr('编辑本步动作'),'edit-actor-details'),menuItem(tr('调整移动时间'),'edit-timing','',!m),menuItem(tr('编辑路径节点'),'edit-path','E',!m),menuItem(tr('复制站位'),'human-copy','⌘/Ctrl C'),menuItem(tr('粘贴站位'),'human-paste','⌘/Ctrl V',!formationClipboard),...(selected.length>1?[menuItem(tr('排成横排'),'human-align-horizontal'),menuItem(tr('排成竖排'),'human-align-vertical')]:[]),null,menuItem(tr('删除本步行动'),'edit-delete-movement','Delete',!selectedEvent()||tool==='initial')];}
function routeMenu(){const n=routeNode(),m=editedMove(),canDelete=n&&(n.key!=='point'||n.index>0&&n.index<m.points.length-1);return[menuItem(tr('添加经过点'),'edit-insert-node-here'),menuItem(tr('编辑路径节点'),'edit-path','E'),...(n?[menuItem(n.key==='point'?tr('删除此经过点'):tr('清除弯度控制点'),'edit-delete-node','Delete',!canDelete)]:[]),menuItem(tr('改为直走'),'human-straight'),menuItem(tr('改为绕弯'),'human-curve'),menuItem(tr('调整移动时间'),'edit-timing'),null,menuItem(tr('删除本步这次行动'),'edit-delete-movement')];}
function nearestRoutePoint(move,p){let result={moveId:move.id,segment:1,t:.5},best=Infinity;for(let index=1;index<move.points.length;index++)for(let j=1;j<40;j++){const t=j/40,q=C.segment(move.points[index-1],move.points[index],t),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<best){best=d;result={moveId:move.id,segment:index,t};}}return result;}
function selectMoveForContext(moveId){const cue=song().cues.find(c=>c.moves.some(m=>m.id===moveId));if(!cue)return null;pause();selectedCue=cue.id;tool='select';stagePhase='end';const m=cue.moves.find(m=>m.id===moveId);selected=[m.entityId];inspect={type:'move',id:m.id};selectedRouteNode=null;renderAll();return m;}
function openEditingContext(ev){
 if(isTypingTarget(ev.target)||$('#dialog').open)return;const target=ev.target,card=target.closest?.('[data-human-step]'),bar=target.closest?.('[data-timeline-bar]'),handle=target.closest?.('[data-handle]'),route=target.closest?.('[data-bend],[data-obj="move"]'),actor=target.closest?.('#stage [data-entity]'),nodeRow=target.closest?.('.route-node-row'),stage=target.closest?.('#stage'),lane=target.closest?.('#bottomContent [data-seek]');
 if(rehearsal){if(!(card||bar||stage||lane))return;ev.preventDefault();showContextMenu(tr('排练'),rehearsalMenu(),ev.clientX,ev.clientY);return;}
 if(card){ev.preventDefault();chooseStep(card.dataset.humanStep,'end',false);showContextMenu(tr('当前步骤'),stepMenu(),ev.clientX,ev.clientY);return;}
 if(bar){ev.preventDefault();const found=findTimelineSelection(bar);if(!found)return;chooseStep(found.e.cue.id,'end',false);if(found.move){selected=[found.move.entityId];inspect={type:'entity',id:found.move.entityId};renderAll();}showContextMenu(found.move?tr('演员行动'):tr('当前步骤'),found.move?actorMenu():stepMenu(),ev.clientX,ev.clientY);return;}
 if(handle&&inspect.type==='move'){ev.preventDefault();selectRouteHandle(handle.dataset.handle);showContextMenu(tr('路径节点'),routeMenu(),ev.clientX,ev.clientY);return;}
 if(nodeRow&&inspect.type==='move'){ev.preventDefault();const button=nodeRow.querySelector?.('[data-action^="edit-node-select:"]');if(button)selectRouteHandle(button.dataset.action.split(':')[1]+':point');showContextMenu(tr('路径节点'),routeMenu(),ev.clientX,ev.clientY);return;}
 if(route){ev.preventDefault();const p=svgPoint(ev),m=selectMoveForContext(route.dataset.bend||route.dataset.id);if(m)showContextMenu(tr('移动路线'),routeMenu(),ev.clientX,ev.clientY,nearestRoutePoint(m,p));return;}
 if(actor){ev.preventDefault();pause();if(!selected.includes(actor.dataset.entity))selected=[actor.dataset.entity];selectedRouteNode=null;inspect={type:selected.length>1?'group':'entity',id:actor.dataset.entity};renderAll();showContextMenu(selected.length>1?tr('多人站位'):displayName(entity(actor.dataset.entity)),actorMenu(),ev.clientX,ev.clientY);return;}
 if(lane&&bottomTab==='timeline'){ev.preventDefault();const rect=lane.getBoundingClientRect(),at=Math.max(0,Math.min(time(),(ev.clientX-rect.left)/rect.width*time()));showContextMenu(fmt(at),[menuItem(tr('从这里播放'),'edit-play-here'),menuItem(tr('定位到这里'),'edit-seek-here'),menuItem(tr('在这里添加步骤'),'edit-step-here'),null,menuItem(tr('适配整曲'),'timeline-fit','0')],ev.clientX,ev.clientY,{time:at});return;}
 if(stage){ev.preventDefault();showContextMenu(tr('舞台'),[menuItem(tr('全选演员与道具'),'edit-select-all','⌘/Ctrl A'),menuItem(tr('粘贴站位'),'human-paste','⌘/Ctrl V',!formationClipboard),menuItem(tr('在播放指针处添加动作'),'human-next-step','N'),menuItem(tr('编辑起始站位'),'tool-initial'),menuItem(tr('舞台设置'),'stage-settings'),null,menuItem(tr('快捷键与右键说明'),'edit-shortcuts','?')],ev.clientX,ev.clientY);}
}
document.addEventListener('contextmenu',openEditingContext);
document.addEventListener('pointerdown',ev=>{if(contextMenuOpen()&&!ev.target.closest?.('#contextMenu'))closeContextMenu(false);},true);
document.addEventListener('click',ev=>{if(ev.target.closest?.('#contextMenu [data-action]'))closeContextMenu(false);});
document.addEventListener('scroll',()=>{if(contextMenuOpen())closeContextMenu(false);},true);
window.addEventListener?.('resize',()=>closeContextMenu(false));
function handleMenuKeys(e){
 if(!contextMenuOpen())return false;const buttons=$$('#contextMenu [role="menuitem"]').filter(b=>!b.disabled),index=buttons.indexOf(document.activeElement);
 if(e.key==='Escape'){e.preventDefault();closeContextMenu(true);return true;}
 if(e.key==='Tab'){closeContextMenu(false);return false;}
 if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();return true;}
 if(e.key==='Enter'||e.code==='Space'){e.preventDefault();const button=buttons[index];if(button){const a=button.dataset.action;closeContextMenu(false);runEditingCommand(a);}return true;}
 closeContextMenu(false);return false;
}
function handleEditingKey(e){
 if(e.defaultPrevented||e.isComposing||e.key==='Process')return;if(handleMenuKeys(e))return;
 const key=e.key.toLowerCase(),cmd=e.metaKey||e.ctrlKey,typing=isTypingTarget(e.target),modalOpen=$('#dialog').open;
 const run=a=>{e.preventDefault();runEditingCommand(a);};
 if(cmd&&key==='s'){e.preventDefault();if(typing)e.target.blur?.();Promise.resolve(saveWork()).catch(x=>toast(x.message));return;}
 if(modalOpen)return;
 if(cmd&&key==='o'){run('open');return;}if(cmd&&key==='k'){run('search');return;}if(typing)return;
 if(cmd){
  if(key==='z'){e.preventDefault();undo(e.shiftKey);return;}if(key==='y'){e.preventDefault();undo(true);return;}
  if(key==='d'){run('edit-duplicate-step');return;}if(key==='a'){run('edit-select-all');return;}
  if(key==='c'){if(!window.getSelection?.()?.toString())run('human-copy');return;}if(key==='v'){if(formationClipboard&&canEdit())run('human-paste');return;}return;
 }
 if((e.shiftKey&&e.key==='F10')||e.key==='ContextMenu'){
  e.preventDefault();const rect=e.target.getBoundingClientRect?.()||{left:20,bottom:150};showContextMenu(rehearsal?tr('排练'):routeNode()?tr('路径节点'):selected.length?tr('演员行动'):tr('当前步骤'),rehearsal?rehearsalMenu():routeNode()?routeMenu():selected.length?actorMenu():stepMenu(),rect.left+10,rect.bottom||150);return;
 }
 const focusedHandle=e.target.closest?.('[data-handle]');if(focusedHandle&&inspect.type==='move'){selectRouteHandle(focusedHandle.dataset.handle,false);if(e.key==='Enter'){e.preventDefault();renderInspector();return;}}
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(!e.repeat)deleteSelection();return;}
 if(e.key==='Escape'){
  e.preventDefault();if(routeNode()){selectedRouteNode=null;renderAll();}else if(inspect.type==='move')finishPathEditing();else{selected=[];inspect={type:selectedCue?'cue':'song',id:selectedCue||songId};renderAll();}return;
 }
 if(e.code==='Space'){run(e.shiftKey?'human-preview':'play');return;}
 if(e.key==='?'&&!e.altKey){run('edit-shortcuts');return;}
 if(e.key==='PageUp'||e.key==='['){run('human-prev');return;}if(e.key==='PageDown'||e.key===']'){run('human-next');return;}
 if(e.key==='Home'||e.key==='End'){const list=C.events(song()),event=e.key==='Home'?list[0]:list.at(-1);if(event){e.preventDefault();chooseStep(event.cue.id);}return;}
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
  if(e.target.closest?.('[data-timeline-bar]'))return;
  if(!rehearsal&&(routeNode()||selected.length)){e.preventDefault();const amount=e.shiftKey?5:1,dx=e.key==='ArrowLeft'?-amount:e.key==='ArrowRight'?amount:0,dy=e.key==='ArrowUp'?-amount:e.key==='ArrowDown'?amount:0;if(routeNode())nudgePathNode(dx,dy);else moveSelection(dx,dy);return;}
  if(e.key==='ArrowLeft')run('human-prev');if(e.key==='ArrowRight')run('human-next');return;
 }
 if(e.altKey)return;
 if(key==='n'&&!e.repeat){if(canEdit())run('human-next-step');return;}if(key==='e'){run('edit-path');return;}if(key==='v'){run('edit-finish-path');return;}if(e.key==='F2'){run('edit-rename-step');return;}
 if(['+','=','-','0'].includes(e.key)){const timeline=bottomTab==='timeline';run(e.key==='0'?(timeline?'timeline-fit':'zoom-reset'):e.key==='-'?(timeline?'timeline-zoom-out':'zoom-out'):(timeline?'timeline-zoom-in':'zoom-in'));return;}
 if(e.key==='Enter'&&e.target.closest?.('#stage [data-entity]')){e.preventDefault();inspectObject('entity',e.target.closest('[data-entity]').dataset.entity);}
}
document.addEventListener('keydown',handleEditingKey);
