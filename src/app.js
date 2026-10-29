'use strict';
const tr=StageI18n.translate, ui=StageI18n.html;
StageI18n.applyStatic(document);
const C=StageCore, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeHTML, appHTML='<!doctype html>\n'+document.documentElement.outerHTML;
const palette=['#376f7b','#a96c52','#8a718e','#72845a','#c19b4b','#5c7fac','#aa6078','#6e8a83'];
let lib=C.clone(PAYLOAD.demo),showId=lib.shows[0]?.id,songId=lib.shows[0]?.songs[0]?.id;
let current=0,playing=false,rate=1,audio=new Audio(),audioURL=null,audioDuration=0,lastClock=0,frame=0,countdownTimer=null;
let leftTab='songs',bottomTab='timeline',rehearsal=false,focusActor='',tool='select',rotation=0,zoom=1,selected=[],inspect={type:'song',id:songId},selectedCue=null;
let editVersion=0;
let dirty=false,history=[],future=[],historyFiles=[],futureFiles=[],rootDir=null,diskSnapshots=new Map(),resources=new Map(),pendingAssets=new Map(),issuesCache=[],loop=null,lastNoteKey='',restoring=false;
const show=()=>lib.shows.find(s=>s.id===showId), song=()=>show()?.songs.find(s=>s.id===songId), entity=id=>[...(show()?.actors||[]),...(show()?.props||[])].find(e=>e.id===id);
const activeEntities=()=>[...(song()?.castIds||[]),...(song()?.propIds||[])].map(entity).filter(Boolean);
const fmt=(v,dec=1)=>{v=Math.max(0,Number(v)||0);return `${String(Math.floor(v/60)).padStart(2,'0')}:${(v%60).toFixed(dec).padStart(dec?4:2,'0')}`;};
const time=()=>C.total(song(),audioDuration);
const stepPausesEnabled=()=>show()?.pauseAtSteps!==false;
const displayName=e=>e?.name||e?.label||e?.id||tr('未知对象');
const field=(label,key,value,type='text',extra='')=>`<label class="field"><span>${esc(label)}</span><input data-field="${esc(key)}" type="${type}" value="${esc(value??'')}" ${extra}></label>`;
const notesField=(obj,key='notes')=>ui`<label class="field"><span>自由备注</span><textarea aria-label="自由备注" data-field="${key}" placeholder="动作、眼神、道具去向、排练提醒……">${esc(obj?.[key]||'')}</textarea></label>`;
function toast(s){$('#toast').textContent=s;$('#toast').classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.add('hidden'),4200);}
function modal(title,body){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=body;if(!$('#dialog').open)$('#dialog').showModal();}
function closeModal(){$('#dialog').close();}
function setInterfaceLanguage(language){
 const previous=StageI18n.language;if(language===previous)return;
 const savedStatus=$('#saveState').textContent,savedToast=$('#toast').textContent;
 const scrolls=['#leftContent','#rightPanel','#inspector','#bottomContent','#lyricsList'].map(id=>({id,top:$(id).scrollTop,left:$(id).scrollLeft}));
 if(!StageI18n.setLanguage(language))return;
 audioError=StageI18n.retranslateStatus(audioError,previous);
 closeContextMenu(false);StageI18n.applyStatic(document);renderAll();
 $('#saveState').textContent=StageI18n.retranslateStatus(savedStatus,previous);
 $('#saveState').title=dirty?tr('有未保存修改'):rootDir?tr('保存到')+' '+rootDir.name:tr('已打开');
 $$('[data-action=save]').forEach(button=>{button.textContent=tr(dirty?'保存 ·':'保存');button.title=dirty?tr('有未保存修改'):rootDir?tr('保存到')+' '+rootDir.name:tr('下载演出包');});
 for(const item of scrolls){$(item.id).scrollTop=item.top;$(item.id).scrollLeft=item.left;}
 if(savedToast)$('#toast').textContent=StageI18n.retranslateStatus(savedToast,previous);
 toast(tr('界面语言已切换'));
}
$('#interfaceLanguage').addEventListener('change',event=>setInterfaceLanguage(event.target.value));
function fileSnapshot(){return{resources:new Map(resources),pending:new Map(pendingAssets),root:rootDir,snapshots:new Map(diskSnapshots),parent:typeof appRootDir==='undefined'?null:appRootDir};}
function snapshot(){history.push(C.clone(lib));historyFiles.push(fileSnapshot());if(history.length>45){history.shift();historyFiles.shift();}future=[];futureFiles=[];$$('[data-action=undo]').forEach(b=>b.disabled=false);$$('[data-action=redo]').forEach(b=>b.disabled=true);}
function mutate(fn,render=true){snapshot();fn();changed();if(render)renderAll();}
function changed(){editVersion++;dirty=true;$('#saveState').textContent=tr('未保存');$('#saveState').classList.add('dirty');$$('[data-action=save]').forEach(b=>{b.textContent=tr('保存 ·');b.title=tr('有未保存修改');});clearTimeout(changed.timer);changed.timer=setTimeout(saveDraft,650);}
function clean(){dirty=false;$('#saveState').textContent=rootDir?tr('已保存到文件夹'):tr('已下载演出包');$('#saveState').classList.remove('dirty');$$('[data-action=save]').forEach(b=>{b.textContent=tr('保存');b.title=rootDir?tr('保存到 ')+rootDir.name:tr('下载演出包');});saveDraft();}
function undo(redo=false){
 closeContextMenu(false);selectedRouteNode=null;lyricEditId=null;pause();const src=redo?future:history,dst=redo?history:future,srcFiles=redo?futureFiles:historyFiles,dstFiles=redo?historyFiles:futureFiles;if(!src.length)return;
 const oldTime=current,oldSong=showId+'/'+songId;
 const oldKey=showId+'/'+songId+'/'+(song().audio?.file||''),assetKey=song().audio?keyPath()+song().audio.file:null,oldAsset=assetKey&&(pendingAssets.get(assetKey)||resources.get(assetKey));
 dst.push(C.clone(lib));dstFiles.push(fileSnapshot());lib=src.pop();const files=srcFiles.pop();if(files){resources=files.resources;pendingAssets=files.pending;if(rootDir!==files.root)diskSnapshots=files.snapshots;rootDir=files.root;if(typeof appRootDir!=='undefined')appRootDir=files.parent;}
 repairSelection();if(oldSong===showId+'/'+songId)positionMusicCursor(oldTime);changed();renderAll();const newAssetKey=song().audio?keyPath()+song().audio.file:null,newAsset=newAssetKey&&(pendingAssets.get(newAssetKey)||resources.get(newAssetKey));if(oldKey!==showId+'/'+songId+'/'+(song().audio?.file||'')||oldAsset!==newAsset||audioState==='loading'||audioImportBusy)loadAudio().then(()=>renderAll());
}

function repairSelection(){if(!show())showId=lib.shows[0]?.id;if(!song())songId=show()?.songs[0]?.id;selected=selected.filter(id=>activeEntities().some(e=>e.id===id));if(!song().cues.some(c=>c.id===selectedCue))prepareHumanScene();else{stagePhase='end';inspect=selected.length>1?{type:'group'}:selected.length===1?{type:'entity',id:selected[0]}:{type:'cue',id:selectedCue};}}
function target(){const s=show(),q=song();if(!s||!q)return null;switch(inspect.type){case 'show':return s;case 'stage':return s.stage;case 'song':return q;case 'entity':return entity(inspect.id);case 'cue':return q.cues.find(x=>x.id===inspect.id);case 'move':return q.cues.flatMap(x=>x.moves).find(x=>x.id===inspect.id);case 'lyric':return q.lyrics.find(x=>x.id===inspect.id);case 'annotation':return q.annotations.find(x=>x.id===inspect.id);case 'anchor':return s.stage.anchors.find(x=>x.id===inspect.id);case 'wall':return s.stage.walls.find(x=>x.id===inspect.id);case 'backstage':return s.stage.backstage.find(x=>x.id===inspect.id);}}
function inspectObject(type,id){if(type!=='move')selectedRouteNode=null;inspect={type,id};if(type==='entity'){pause();singleStepEnd=null;selected=[id];syncPlaybackContext();inspect={type,id};}if(type==='cue'){selectedCue=id;}if(type==='move'){const c=song().cues.find(c=>c.moves.some(m=>m.id===id));selectedCue=c?.id;selected=[target()?.entityId].filter(Boolean);}if(['cue','move'].includes(type)&&!rehearsal){pause();singleStepEnd=null;stagePhase='end';tool='select';}renderInspector();renderStage();renderBottom();renderEditorBar();updateTransport();renderLyricsDock();}
async function switchSong(id){pause();songId=id;selected=[];prepareHumanScene();focusActor=song()?.castIds[0]||'';renderAll();await loadAudio();renderAll();}
async function switchShow(id){pause();showId=id;songId=show().songs[0]?.id;selected=[];prepareHumanScene();focusActor=song()?.castIds[0]||'';renderAll();await loadAudio();renderAll();}
function renderAll(){
 if(!song())return;
 syncRouteSelection();if(!playing&&stagePhase==='live')syncPlaybackContext();
 $('#showButton').textContent=(show().title||tr('未命名演出'))+' ▾';$('#songTitle').textContent=song().title;
 $('#songEyebrow').textContent=ui`曲目 ${String(show().songs.indexOf(song())+1).padStart(2,'0')}`;
 $('#songSubtitle').textContent=ui`${song().cues.length} 个步骤`;
 $('#workspace').classList.toggle('rehearsing',rehearsal);$('#reloadButton').disabled=!rootDir;
 $('#reloadButton').title=rootDir?tr('读取 ')+rootDir.name+tr(' 的最新文件'):tr('先通过导入走台连接演出文件夹');
 $$('[data-action=undo]').forEach(b=>b.disabled=!history.length);$$('[data-action=redo]').forEach(b=>b.disabled=!future.length);
 $('#castSummary').textContent=ui`${song().castIds.length} 位角色 · ${song().propIds.length} 件道具`;
 $('#selectedSummary').textContent=selected.length?ui`已选 ${selected.length} 个对象`:tr('自由单位 · 俯视图');
 $('#editMode').classList.toggle('selected',!rehearsal);$('#rehearseMode').classList.toggle('selected',rehearsal);
 $('#toolInitial').classList.toggle('selected',tool==='initial');$('#toolSelect').classList.toggle('selected',tool==='select');
 $('#stageHint').textContent=inspect.type==='move'&&!rehearsal?tr('点选经过点后按 Delete 删除 · 右键添加节点'):rehearsal?tr('选择你的角色，跟着音乐排练'):tool==='initial'?tr('拖动演员，摆好开场位置'):stagePhase==='start'?tr('正在查看起点 · 切到「落点」继续编排'):selected.length?tr('拖演员改位置 · 拖路线圆点改弯度'):tr('拖动演员摆位 · Shift 多选');
 issuesCache=C.issues(show(),song());$('#issuesButton').textContent=issuesCache.length?ui`${issuesCache.length} 处待检查`:tr('检查走台');$('#issuesButton').classList.toggle('warning',issuesCache.some(i=>i.level==='error'));
 renderLeft();renderStage();renderInspector();renderBottom();updateTransport();renderEditorBar();renderLyricsDock();
}
function renderLeft(){
 $('#leftTabs').innerHTML=[['songs',tr('曲目')],['actors',tr('角色')],['props',tr('道具')]].map(([k,v])=>`<button data-action="left-${k}" class="${leftTab===k?'selected':''}">${v}</button>`).join('');
 const s=show(),q=song();
 if(leftTab==='songs')$('#leftContent').innerHTML=ui`<div class="sectionlabel">曲目 <span>${s.songs.length}</span><button class="tiny" data-action="add-song">＋ 新建</button></div>`+s.songs.map((q,i)=>`<button class="songcard ${q.id===songId?'active':''}" data-song="${esc(q.id)}" aria-current="${q.id===songId?'true':'false'}"><span class="number">${String(i+1).padStart(2,'0')}</span><span class="songcard-copy"><strong>${esc(q.title)}</strong><small>${q.cues.length?ui`${q.cues.length} 个步骤`:tr('待编排')}${q.audio?' · ♫':''}</small></span></button>`).join('')+ui`<button class="full muted show-settings" data-action="show-settings">演出设置</button>`;

 else {
 const isActor=leftTab==='actors',list=isActor?s.actors:s.props,ids=isActor?q.castIds:q.propIds;
 $('#leftContent').innerHTML=ui`<div class="sectionlabel">${isActor?tr('全场角色名单'):tr('全场道具')} / ${list.length}<button class="tiny" data-action="add-${isActor?'actor':'prop'}">＋ 添加</button></div><p class="muted" style="font-size:10px">勾选本曲目使用的对象；未勾选者只保留在名单。</p>`+list.map(e=>ui`<div class="listitem ${selected.includes(e.id)?'active':''}" data-entity="${esc(e.id)}"><input type="checkbox" data-participation="${esc(e.id)}" ${ids.includes(e.id)?'checked':''} aria-label="${esc(e.name)}参与本曲目"><span class="entitydot ${isActor?'':'prop'}" style="background:${safeColor(e.color)}">${esc(e.label)}</span><div class="label"><b>${esc(e.name)}</b><small>${ids.includes(e.id)?tr('本曲目参演'):tr('未参与本曲目')}</small></div></div>`).join('');
 }
}
function safeColor(s){return /^#[0-9a-f]{3,8}$/i.test(s||'')?s:'#7b8367';}
function renderStage(){
 const s=show(),q=song();if(!q)return;
 const svg=$('#stage'),bounds=[...C.flatten(s.stage.boundary),...s.stage.backstage.flatMap(z=>z.points)];
 const width=Math.max(180,...bounds.map(p=>Math.abs(p.x)*2+28)),height=Math.max(115,...bounds.map(p=>Math.abs(p.y)*2+35));
 const vw=(rotation%180?height:width)/zoom,vh=(rotation%180?width:height)/zoom;const visualScale=Math.max(.2,Math.min(svg.clientWidth/vw,svg.clientHeight/vh));svg.setAttribute('viewBox',`${-vw/2} ${-vh/2} ${vw} ${vh}`);
 $('#rotationLabel').textContent=rotation+'°';
 let html=`<defs><marker id="routeArrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto-start-reverse"><path d="M 0 0 L 5 2.5 L 0 5 Z" fill="context-stroke"/></marker><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#8c7a55" stroke-opacity=".16" stroke-width=".2"/></pattern><filter id="shadow"><feDropShadow dx="0" dy=".6" stdDeviation=".5" flood-opacity=".19"/></filter></defs><g id="scene" transform="rotate(${rotation})">`;
 for(const z of s.stage.backstage)html+=`<path d="${C.path(z.points,true)}" fill="#ad9c7d27" stroke="#9a8b6b" stroke-width=".35" stroke-dasharray="1 1" data-obj="backstage" data-id="${esc(z.id)}"/><text x="${z.points[0].x+3}" y="${z.points[0].y+4}" fill="#8b7854" font-size="${Math.max(2.5,8/visualScale)}" pointer-events="none">${esc(z.name)}</text>`;
 html+=`<path d="${C.path(s.stage.boundary,true)}" fill="#f3ecd9" stroke="#9b855c" stroke-width=".6" data-obj="stage"/>`;
 if($('#showGrid').checked)html+=`<path d="${C.path(s.stage.boundary,true)}" fill="url(#grid)" pointer-events="none"/>`;
 html+=`<path d="M -3 0 H 3 M 0 -3 V 3" stroke="#a28d61" stroke-width=".3" opacity=".5" pointer-events="none"/>`;
 for(const w of s.stage.walls)html+=`<path d="${C.path(w.points)}" fill="none" stroke="#695b43" stroke-width="1.4" data-obj="wall" data-id="${esc(w.id)}" style="cursor:pointer"/>`;
 for(const a of s.stage.anchors)if(C.point(a))html+=`<g data-obj="anchor" data-id="${esc(a.id)}" style="cursor:pointer"><path d="M ${a.x-1.2} ${a.y} h 2.4 M ${a.x} ${a.y-1.2} v 2.4" stroke="#8f7547" stroke-width=".4"/><text x="${a.x+2}" y="${a.y-2}" fill="#8c774f" font-size="${Math.max(2.5,8/visualScale)}">${esc(a.name)}</text></g>`;
 const eventList=C.events(q),chosen=!rehearsal&&!playing&&stagePhase!=='live'&&tool!=='initial'&&eventList.find(e=>e.cue.id===selectedCue),currentEvent=eventList.filter(e=>e.start<=current).at(-1);
 if($('#showRoutes').checked){
 const routeEvents=chosen?[chosen]:eventList.filter(e=>e.cue.moves.some(m=>{const t=C.moveEvent(e,m);return current>=t.start&&current<=t.end||(rehearsal&&t.start>current&&m.entityId===focusActor);})).slice(0,2);
 for(const e of routeEvents)for(const m of e.cue.moves){if(!rehearsal&&!$('#allRoutes').checked&&!selected.includes(m.entityId))continue;const ent=entity(m.entityId);if(!ent)continue;const error=issuesCache.some(i=>i.type==='move'&&i.id===m.id&&i.level==='error');const color=error?'#bc4937':safeColor(ent.color);const dim=rehearsal?m.entityId!==focusActor:selected.length>0&&!selected.includes(m.entityId);html+=`<path d="${C.path(m.points)}" fill="none" stroke="${color}" stroke-width="${dim?.4:.7}" stroke-dasharray="1.5 1" marker-end="url(#routeArrow)" opacity="${dim?.18:.8}" data-obj="move" data-id="${esc(m.id)}" style="cursor:pointer"/>`;}
 }
 if(showGhosts&&chosen&&!playing&&!rehearsal&&tool!=='initial'&&stagePhase==='end')for(const m of chosen.cue.moves){const p=m.points[0],end=m.points.at(-1),ent=entity(m.entityId);if(!$('#allRoutes').checked&&!selected.includes(m.entityId))continue;if(ent&&C.point(p)&&Math.hypot(end.x-p.x,end.y-p.y)>.2)html+=`<g pointer-events="none" opacity="${selected.length&&!selected.includes(m.entityId)?.2:.6}"><circle cx="${p.x}" cy="${p.y}" r="${Math.max(2.6,8/visualScale)}" fill="none" stroke="${safeColor(ent.color)}" stroke-dasharray="1 1" stroke-width=".55"/></g>`;}
 for(const ent of activeEntities().sort((a,b)=>Number(selected.includes(a.id)||rehearsal&&a.id===focusActor)-Number(selected.includes(b.id)||rehearsal&&b.id===focusActor))){
 const p=viewPosition(ent.id);if(!p)continue;const prop=s.props.some(p=>p.id===ent.id),chosenEnt=selected.includes(ent.id),highlight=rehearsal&&focusActor===ent.id,dim=rehearsal&&!highlight;const r=Math.max(3.3,11/visualScale)*(highlight?1.12:1);const label=String(ent.label||ent.name||'?');
 html+=`<g data-entity="${esc(ent.id)}" role="button" aria-label="${esc(ent.name)}" tabindex="0" transform="translate(${p.x} ${p.y})" opacity="${dim?.38:1}" class="object-control">${highlight||chosenEnt?`<circle r="${r+1.1}" fill="none" stroke="${highlight?'#9d7832':'#4a473e'}" stroke-width=".45" stroke-dasharray="${highlight?'':'1 1'}"/>`:''}${prop?`<rect x="-${r}" y="-${r}" width="${r*2}" height="${r*2}" rx=".8"`:`<circle r="${r}"`} fill="${safeColor(ent.color)}" stroke="#fffae8" stroke-width=".45" filter="url(#shadow)"/><text transform="rotate(${-rotation})" y=".15" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="${Math.min(r*.98,r*3.3/(label.length||1))}" font-weight="600" pointer-events="none">${esc(label)}</text></g>`;
 }
 if(!rehearsal&&!playing&&stagePhase==='end'&&tool!=='initial'&&$('#showRoutes').checked&&inspect.type!=='move'){
  const e=selectedEvent();for(const move of e?.cue.moves||[]){if(!selected.includes(move.entityId))continue;for(let i=1;i<move.points.length;i++){
   const a=move.points[i-1],b=move.points[i];if(Math.hypot(b.x-a.x,b.y-a.y)<.2)continue;const mid=C.segment(a,b,.5),r=Math.max(1.5,6/visualScale);
   html+=ui`<path d="${C.path([a,b])}" fill="none" stroke="transparent" stroke-width="${Math.max(3,14/visualScale)}" data-bend="${esc(move.id)}" data-segment="${i}" style="cursor:grab"/><g data-bend="${esc(move.id)}" data-segment="${i}" role="button" aria-label="拖动调整${esc(displayName(entity(move.entityId)))}的路线" class="bend-handle" style="cursor:grab"><circle cx="${mid.x}" cy="${mid.y}" r="${r*1.8}" fill="transparent"/><circle cx="${mid.x}" cy="${mid.y}" r="${r}" fill="#fff4d3" stroke="#8e6c30" stroke-width=".5"/><circle cx="${mid.x}" cy="${mid.y}" r="${r*.28}" fill="#8e6c30"/></g>`;
  }}
 }
 const m=inspect.type==='move'?target():null;
 if(m&&!rehearsal&&!playing&&stagePhase==='end'&&tool!=='initial')html+=routeHandlesHTML(m,visualScale);
 if(inspect.type==='stage'&&!rehearsal)s.stage.boundary.forEach((p,i)=>{html+=`<circle cx="${p.x}" cy="${p.y}" r="1.1" fill="#d9b777" stroke="#735d34" stroke-width=".4" data-boundary="${i}:point" class="object-control"/>`;for(const k of ['c1','c2'])if(p[k])html+=`<circle cx="${p[k].x}" cy="${p[k].y}" r=".9" fill="#bd7b57" data-boundary="${i}:${k}" class="object-control"/>`;});
 const audience=s.stage.audience||'south';const ax=audience==='west'?-width/2+7:audience==='east'?width/2-7:0,ay=audience==='north'?-height/2+7:audience==='south'?height/2-7:0;
 html+=ui`<g transform="translate(${ax} ${ay}) rotate(${-rotation})"><text text-anchor="middle" font-size="2.5" fill="#8b7249" letter-spacing="1.5">— 观 众 侧 —</text></g></g>`;
 svg.innerHTML=html;$('#currentCue').textContent=tool==='initial'?tr('起始站位'):(!playing&&stagePhase!=='live'&&chosen?chosen:currentEvent)?.cue.title||tr('起始站位');
}
function renderInspector(){
 $('#inspectorTitle').textContent=rehearsal?tr('演员排练'):tr('详情与笔记');
 if(rehearsal){renderRehearsal();return;}
 if(renderHumanInspector())return;
 const t=target()||song();if(!target())inspect={type:'song',id:songId};const type=inspect.type,q=song();
 let html=`<span class="tag">${({show:'PRODUCTION',stage:'STAGE PLAN',song:'SONG',entity:'CHARACTER / PROP',cue:'BLOCKING STEP',move:'MOVEMENT',lyric:'LYRIC',annotation:'NOTE',anchor:'MARK',wall:'WALL',backstage:'BACKSTAGE'})[type]||'DETAIL'}</span>`;
 if(type==='show')html+=field(tr('演出名称'),'title',t.title)+notesField(t)+ui`<button class="danger full" data-action="delete-show">删除这场演出</button>`;
 else if(type==='song'){
 html+=field(tr('曲目名称'),'title',t.title)+ui`<label class="field"><span>演示方式</span><select data-field="mode"><option value="steps" ${t.mode==='steps'?'selected':''}>按步骤（可无音乐）</option><option value="timed" ${t.mode==='timed'?'selected':''}>按时间（可静音计时）</option></select></label>`+field(tr('演示总时长（秒，可留空自动计算）'),'duration',t.duration,'number','min="0" step="0.1"')+notesField(t)+ui`<div class="row wrap"><button data-action="duplicate-song">复制曲目</button><button data-action="shift-times">整体调整时间</button></div><button class="full" data-action="remove-audio">移除音乐引用</button><button class="danger full" data-action="delete-song">删除曲目</button><p class="footer-note">音乐和歌词都可缺省。演出文件保持普通文本，外部 AI 编辑后点“重新加载”。</p>`;
 }else if(type==='entity'){
 const p=q.initial[t.id]||{x:0,y:0};html+=field(tr('角色／道具名称'),'name',t.name)+ui`<div class="two">${field(tr('舞台短标签'),'label',t.label)}${field(tr('颜色'),'color',t.color,'color')}</div><h3>本曲目起始位置</h3><div class="two">${field('X','initial.x',p.x,'number','step="0.1"')}${field('Y','initial.y',p.y,'number','step="0.1"')}</div>`+notesField(t)+ui`<button class="full" data-action="entity-records">查看本曲目全部记录</button><button class="danger full" data-action="delete-entity">从演出删除对象</button>`;
 }else if(type==='cue'){
 const ev=C.events(q).find(e=>e.cue.id===t.id);$('#inspectorTitle').textContent=tr('本步笔记');
 html=field(tr('步骤名称'),'title',t.title)+ui`<label class="field"><span>这一步的安排</span><textarea aria-label="本步安排" data-field="notes" placeholder="例如：所有人面向观众，Burr 向前两步。">${esc(t.notes||'')}</textarea></label><p class="context-tip">点击舞台上的演员，写下他在这一步的动作。</p><details class="advanced-details"><summary>时间与暂停 · ${t.duration} 秒</summary>${q.mode==='timed'?field(tr('开始秒数'),'at',t.at,'number','min="0" step="0.1"'):''}${field(tr('移动时长（秒）'),'duration',t.duration,'number','min="0" step="0.1"')}<label class="smallcheck"><input type="checkbox" data-field="stopAfter" ${t.stopAfter?'checked':''}>到达后暂停</label>${!stepPausesEnabled()?tr('<p class="footer-note">当前为连续播放，暂停标记暂不生效。</p>'):''}</details><details class="advanced-details"><summary>本步行动 · ${t.moves.length}</summary>`+t.moves.map(m=>`<button class="routeitem full" data-inspect="entity" data-id="${esc(m.entityId)}">${esc(displayName(entity(m.entityId)))}</button>`).join('')+ui`</details><details class="advanced-details"><summary>复制、排序与删除</summary><div class="row wrap"><button data-action="cue-up">↑ 前移</button><button data-action="cue-down">↓ 后移</button><button data-action="duplicate-cue">复制步骤</button><button class="danger" data-action="delete-cue">删除步骤</button></div></details>`;

 }else if(type==='move'){
 html=pathInspectorHTML(t);
 }else if(type==='lyric')html+=ui`<label class="field"><span>歌词文字</span><textarea data-field="text">${esc(t.text)}</textarea></label><div class="two">${field(tr('开始秒数'),'start',t.start,'number','min="0" step="0.1"')}${field(tr('结束秒数'),'end',t.end,'number','min="0" step="0.1"')}</div>`+notesField(t)+ui`<button class="danger full" data-action="delete-lyric">删除这句歌词</button>`;
 else if(type==='annotation')html+=field(tr('记录标题'),'title',t.title)+ui`<div class="two">${field(tr('开始秒数（可空）'),'start',t.start,'number','min="0" step="0.1"')}${field(tr('结束秒数（可空）'),'end',t.end,'number','min="0" step="0.1"')}</div><div class="field"><span>提醒谁（不选则提醒全体）</span><div class="people-checks">${activeEntities().map(en=>`<label><input type="checkbox" data-note-entity="${esc(en.id)}" ${t.entityIds?.includes(en.id)?'checked':''}>${esc(en.name)}</label>`).join('')}</div></div>`+notesField(t)+ui`<button class="danger full" data-action="delete-annotation">删除这条记录</button>`;

 else if(type==='stage'){
 html+=ui`<h2 style="margin-top:14px">固定舞台 · 自由单位</h2><label class="field"><span>观众所在方向（原始坐标）</span><select data-field="audience">${[['south',tr('下侧')],['north',tr('上侧')],['west',tr('左侧')],['east',tr('右侧')]].map(([v,l])=>`<option value="${v}" ${t.audience===v?'selected':''}>${l}</option>`).join('')}</select></label><p class="footer-note">X 向右，Y 向下。四向旋转只改变视图。边界圆点和曲线控制点可以直接拖动。</p><div class="row wrap"><button data-action="add-anchor">＋ 标记／入口</button><button data-action="add-wall">＋ 墙</button><button data-action="add-backstage">＋ 后台</button></div>`+['anchors','walls','backstage'].map(k=>`<h3>${({anchors:tr('标记与出入口'),walls:tr('墙'),backstage:tr('后台区域')})[k]}</h3>`+t[k].map(x=>`<div class="routeitem" data-inspect="${({anchors:'anchor',walls:'wall',backstage:'backstage'})[k]}" data-id="${esc(x.id)}">${esc(x.name)}</div>`).join('')).join('')+notesField(t)+ui`<button class="full" data-action="stage-json">编辑舞台坐标文本</button>`;
 }else {
 html+=field(tr('名称'),'name',t.name);if(type==='anchor')html+=ui`<div class="two">${field('X','x',t.x,'number','step="0.1"')}${field('Y','y',t.y,'number','step="0.1"')}</div><label class="field"><span>类型</span><select data-field="kind"><option value="mark" ${t.kind==='mark'?'selected':''}>位置标记</option><option value="gate" ${t.kind==='gate'?'selected':''}>上下场口</option></select></label>`;else html+=ui`<label class="field"><span>坐标点（JSON）</span><textarea data-field="points" class="importarea">${esc(JSON.stringify(t.points,null,2))}</textarea></label>`;
 html+=notesField(t)+ui`<button class="danger full" data-action="delete-stage-object">删除对象</button>`;
 }
 const relevant=issuesCache.filter(i=>i.type===type&&i.id===inspect.id);html+=relevant.map(i=>`<p class="warning">${esc(i.text)}</p>`).join('');
 $('#inspector').innerHTML=html;
}
function currentLyric(){return song().lyrics.find(l=>l.start<=current&&l.end>current);}
function renderRehearsal(){
 const q=song(),ev=C.moveEvents(q),active=ev.filter(e=>e.start<=current&&e.end>=current&&e.move.entityId===focusActor);const next=ev.find(e=>e.start>current+.02&&e.move.entityId===focusActor);
 let html=ui`<label class="field"><span>这首曲目，我是</span><select id="focusActor">${q.castIds.map(id=>`<option value="${esc(id)}" ${id===focusActor?'selected':''}>${esc(displayName(entity(id)))}</option>`).join('')}</select></label>`;
 if(!q.castIds.length)html+=tr('<div class="empty">先在左侧角色名单勾选参演者。</div>');
 const lyric=currentLyric();if(lyric&&!lyricDockVisible)html+=ui`<h3>当前歌词</h3><div class="rehearsal-lyric">${esc(lyric.text)}</div>${lyric.notes?`<div class="notecard">${esc(lyric.notes)}</div>`:''}`;
 html+=ui`<div class="rehearsal-card"><div class="eyebrow">下一次移动</div><div class="big" id="nextCountdown">${next?(next.start-current).toFixed(1)+tr(' 秒'):'—'}</div><div>${esc(next?.cue.title||tr('本曲目没有后续移动'))}</div></div>`;
 html+=tr('<h3>当前行动</h3>');if(!active.length)html+=tr('<p class="context-tip">这一步保持站位，等待下一次行动。</p>');
 for(const e of active){html+=`<div class="notecard"><small>${fmt(e.start)} → ${fmt(e.end)} · ${esc(e.cue.title)}</small>${esc(e.cue.notes||tr('沿舞台路线移动'))}${e.move.notes?'<br>'+esc(e.move.notes):''}</div>`;}
 for(const a of q.annotations)if((!a.entityIds?.length||a.entityIds.includes(focusActor))&&(a.start==null||a.start<=current)&&(a.end==null||a.end>=current))html+=`<div class="notecard"><small>${esc(a.title)}</small>${esc(a.notes)}</div>`;
 const en=entity(focusActor);if(en?.notes)html+=ui`<details class="advanced-details"><summary>角色提醒</summary><div class="notecard">${esc(en.notes)}</div></details>`;
 if(q.notes)html+=ui`<details class="advanced-details"><summary>曲目说明与参考资料</summary><div class="notecard">${esc(q.notes)}</div></details>`;
 html+=ui`<button data-action="actor-records" class="full">查看我的全部记录</button>`;$('#inspector').innerHTML=html;
}
function renderBottom(){
 $('#timelineZoomBar').classList.toggle('hidden',bottomTab!=='timeline');
 for(const t of ['steps','timeline','lyrics','notes'])$('#'+t+'Tab').classList.toggle('selected',bottomTab===t);
 if(bottomTab==='steps'){renderStepCards();return;}
 $('#timelineHint').textContent=song().mode==='steps'?tr('顺序演示 · 拖动步骤可查看详情'):tr('点击空白跳转 · 拖动色条调整时间');
 if(bottomTab==='timeline'){renderTimeline();
 }else if(bottomTab==='lyrics')$('#bottomContent').innerHTML=ui`<div class="lyricslist"><div class="row"><button data-action="lyrics">导入逐句歌词</button><button data-action="add-lyric">＋ 手动添加</button></div>`+(song().lyrics.length?song().lyrics.map(l=>ui`<div class="lyricrow ${l.start<=current&&l.end>current?'active':''}" data-lyric="${esc(l.id)}"><span class="lyrictime">${fmt(l.start)}–${fmt(l.end)}</span><span class="lyrictext">${esc(l.text)}</span><button class="tiny" data-inspect="lyric" data-id="${esc(l.id)}">编辑</button></div>`).join(''):tr('<div class="empty">没有歌词也可以完整编排。<br>以后导入 AI 对好的逐句秒数即可。</div>'))+'</div>';
 else $('#bottomContent').innerHTML=ui`<div class="noteslist"><div class="row"><button data-action="add-annotation">＋ 自由记录</button><button data-action="search">检索整个演出库</button></div>`+records().filter(r=>r.showId===showId&&(!r.songId||r.songId===songId)).map(recordHTML).join('')+'</div>';
}
function records(){
 const out=[];for(const s of lib.shows){const add=(o,type,label,songId=null,time=null,entityIds=[])=>{if(o.notes)out.push({showId:s.id,songId,type,id:o.id||s.id,label,notes:o.notes,time,entityIds});};add(s,'show',s.title);add(s.stage,'stage',s.title+tr(' / 舞台'));for(const en of [...s.actors,...s.props])add(en,'entity',en.name,null,null,[en.id]);for(const [key,type]of [['anchors','anchor'],['walls','wall'],['backstage','backstage']])for(const a of s.stage[key])add(a,type,a.name);for(const q of s.songs){add(q,'song',q.title,q.id);for(const e of C.events(q)){add(e.cue,'cue',q.title+' / '+e.cue.title,q.id,e.start,e.cue.moves.map(m=>m.entityId));for(const m of e.cue.moves)add(m,'move',q.title+' / '+e.cue.title+' / '+(s.actors.concat(s.props).find(x=>x.id===m.entityId)?.name||m.entityId),q.id,C.moveEvent(e,m).start,[m.entityId]);}for(const l of q.lyrics)add(l,'lyric',l.text,q.id,l.start);for(const a of q.annotations)add(a,'annotation',a.title,q.id,a.start,a.entityIds);}}return out;
}
function recordHTML(r){return `<div class="searchresult" data-record='${esc(JSON.stringify({showId:r.showId,songId:r.songId,type:r.type,id:r.id,time:r.time}))}'><small>${esc(r.label)}${r.time!=null?' · '+fmt(r.time):''}</small><p>${esc(r.notes)}</p></div>`;}

function updatePlayhead(){const head=$('#playhead');if(head){const w=head.parentElement.clientWidth-TIMELINE_LABEL;head.style.left=(TIMELINE_LABEL+Math.min(1,current/time())*w)+'px';}}
function updateTransport(){
 $('#currentTime').textContent=fmt(current);$('#totalTime').textContent='/ '+fmt(time());$('#playButton').textContent=playing?'Ⅱ':'▶';
 const pauses=stepPausesEnabled(),pauseButton=$('#stepPauseButton');pauseButton.textContent=pauses?tr('逐步暂停'):tr('连续播放');pauseButton.classList.toggle('selected',!pauses);pauseButton.setAttribute('aria-pressed',String(pauses));pauseButton.title=pauses?tr('点击统一关闭本场全部曲目的步骤结束暂停'):tr('点击恢复各步骤原有的暂停设置');
 renderAudioStatus();
 $('#loopButton').classList.toggle('selected',!!loop);updatePlayhead();updateLyricsFocus();
}
function setStepPauses(enabled){
 if(stepPausesEnabled()===enabled)return;
 mutate(()=>show().pauseAtSteps=enabled,false);updateTransport();renderInspector();toast(enabled?tr('已恢复各步骤原有的暂停设置。'):tr('本场全部曲目已切为连续播放；预览本步仍会在结束时停止。'));
}
function pause(){audioPlayGeneration++;playing=false;audio.pause();cancelAnimationFrame(frame);clearInterval(countdownTimer);countdownTimer=null;$('#countdownOverlay').classList.add('hidden');updateTransport();if(song())renderEditorBar();}
function positionMusicCursor(t){current=Math.max(0,Math.min(time(),t));if(audioPlayable()&&!audioSilentMode)try{audio.currentTime=Math.min(current,audioDuration||current);if(playing&&audio.paused&&current<audioDuration)audio.play().catch(()=>{if(playing){pause();toast(tr('音乐未能继续播放，请重新点播放。'));}});}catch{}lastClock=performance.now();}
function seek(t){stagePhase='live';positionMusicCursor(t);syncPlaybackContext();renderInspector();renderBottom();renderStage();updateTransport();renderEditorBar();if(rehearsal)renderRehearsal();}
async function play(immediate=false,silent=false){
 if(playing||countdownTimer){pause();return;}const request=++audioPlayGeneration,identity=song();
 if(identity.audio&&!silent){if(audioState==='loading')await audioReady;if(request!==audioPlayGeneration||identity!==song())return;if(!audioPlayable()){toast(tr('音乐未连接，请连接音乐或点「静音走台」。'));return;}}
 stagePhase='live';tool='select';audioSilentMode=silent;if(syncPlaybackContext()){renderInspector();renderBottom();}renderEditorBar();if(current>=time()-.01)seek(loop?.start||0);
 const count=+$('#leadIn').value;if(count&&!immediate){let n=count;$('#countdownOverlay').textContent=n;$('#countdownOverlay').classList.remove('hidden');countdownTimer=setInterval(()=>{n--;if(n<=0){clearInterval(countdownTimer);countdownTimer=null;$('#countdownOverlay').classList.add('hidden');play(true,silent);}else $('#countdownOverlay').textContent=n;},1000);return;}
 playing=true;lastClock=performance.now();if(audioPlayable()&&!silent&&current<audioDuration){const player=audio;player.currentTime=current;player.playbackRate=rate;try{await startAudioPlayback(player);if(request!==audioPlayGeneration||player!==audio||!playing){player.pause();return;}beginAudioProgress(player);}catch(e){if(request!==audioPlayGeneration)return;playing=false;if(e.name==='TimeoutError'){player.pause();audioState='error';audioError=tr('音乐启动超时，请重新连接 MP3。');}updateTransport();toast(e.name==='NotAllowedError'?tr('浏览器尚未允许播放音乐，请再点一次播放。'):tr('音乐播放失败，请重新连接音乐。'));return;}}
 if(request!==audioPlayGeneration)return;lastClock=performance.now();updateTransport();renderEditorBar();frame=requestAnimationFrame(tick);
}

function tick(now){
 if(!playing)return;if(!checkAudioProgress(now))return;const before=current;current+=(Math.max(0,now-lastClock)/1000)*rate;lastClock=Math.max(lastClock,now);if(audioPlayable()&&!audioSilentMode&&!audio.paused&&audio.currentTime<audioDuration-.05)current=audio.currentTime;
 let stop=singleStepEnd===null&&stepPausesEnabled()?C.events(song()).map(e=>({...e,end:C.cuePlaybackEnd(e)})).sort((a,b)=>a.end-b.end).find(e=>e.cue.stopAfter&&e.end>before+.001&&e.end<=current):null;
 if(stop){seek(stop.end);pause();if(!rehearsal)chooseStep(stop.cue.id,'end',true,true);return;}
 if(loop&&current>=loop.end){seek(loop.start);if(audioPlayable()&&!audioSilentMode&&current<audioDuration)audio.play().catch(()=>{if(playing){pause();toast(tr('音乐未能继续播放，请重新点播放。'));}});}else if(current>=time()){seek(time());pause();return;}
 if(syncPlaybackContext()){renderInspector();renderEditorBar();renderBottom();}
 if(!tick.lastRender||now-tick.lastRender>33){renderStage();updateTransport();tick.lastRender=now;}
 const key=C.moveEvents(song()).filter(e=>e.start<=current&&e.end>=current).map(e=>e.move.id).join('|')+'|'+currentLyric()?.id;
 if(rehearsal&&key!==lastNoteKey){renderRehearsal();lastNoteKey=key;}else if(rehearsal){const next=C.moveEvents(song()).find(e=>e.start>current+.02&&e.move.entityId===focusActor);if($('#nextCountdown'))$('#nextCountdown').textContent=next?(next.start-current).toFixed(1)+tr(' 秒'):'—';}
 if(bottomTab==='lyrics'&&key!==tick.lyricKey){renderBottom();tick.lyricKey=key;}
 frame=requestAnimationFrame(tick);
}
function nextStep(direction){
 if(!rehearsal){humanAction(direction<0?'human-prev':'human-next');return;}
 pause();const ev=C.events(song());const index=ev.findIndex(e=>e.cue.id===selectedCue),next=ev[index+direction];
 if(next){selectedCue=next.cue.id;seek(next.start);renderAll();}
}

let singleStepEnd=null;
const originalTick=tick;
tick=function(now){if(singleStepEnd!==null&&playing&&current+Math.max(0,now-lastClock)/1000*rate>=singleStepEnd-.001){const end=singleStepEnd,cueId=selectedCue;singleStepEnd=null;seek(end);pause();if(!rehearsal&&cueId)chooseStep(cueId,'end',true,true);return;}originalTick(now);};
function keyPath(){return `shows/${showId}/songs/${songId}/`;}
async function resourceFile(key){const r=pendingAssets.get(key)||resources.get(key);return r?.getFile?await r.getFile():r||embeddedAudioFile(key);}
function prepareHumanSceneAfterDelete(){const at=current;if(selectedCue){chooseStep(selectedCue,'end',false,true);}else{prepareHumanScene();positionMusicCursor(at);renderAll();}}
function addCue(){return createStepAt(current);}
function addEntity(isProp){const name=prompt(isProp?tr('道具名称'):tr('剧中角色名'));if(!name?.trim())return;const list=isProp?show().props:show().actors;const en={id:C.id(isProp?'prop':'actor'),name:name.trim(),label:name.trim().replace(/\s/g,'').slice(0,2),color:palette[list.length%palette.length],notes:''};mutate(()=>{list.push(en);(isProp?song().propIds:song().castIds).push(en.id);song().initial[en.id]={x:0,y:0};},false);leftTab=isProp?'props':'actors';inspect={type:'entity',id:en.id};selected=[en.id];renderAll();}
const liveEditedFields=new WeakSet();
document.addEventListener('input',ev=>{
 const input=ev.target,key=input.dataset?.field;
 if(!key||!['notes','text','name','title','label'].includes(key))return;
 const obj=target();if(!obj)return;
 if(!liveEditedFields.has(input)){snapshot();liveEditedFields.add(input);}
 obj[key]=input.value;changed();
});
document.addEventListener('change',async ev=>{
 const input=ev.target;if(input.matches('[data-field]')){
  const obj=target();if(!obj)return;const key=input.dataset.field;let value=input.type==='checkbox'?input.checked:input.type==='number'?(input.value===''?null:Number(input.value)):input.value;
  try{if(key==='points'){value=JSON.parse(value);if(!Array.isArray(value)||!value.every(C.point))throw Error(tr('请使用有效的坐标点数组。'));}if(key==='entityIds')value=value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
   const apply=()=>{if(key.startsWith('initial.')){song().initial[obj.id]||={x:0,y:0};song().initial[obj.id][key.split('.')[1]]=value;}else {if(key==='mode'&&obj.mode==='steps'&&value==='timed')for(const e of C.events(obj))e.cue.at=e.start;const keys=key.split('.');let ref=obj;for(const p of keys.slice(0,-1))ref=ref[p];ref[keys.at(-1)]=value;}};
   if(liveEditedFields.has(input)){liveEditedFields.delete(input);apply();changed();}else mutate(apply,false);renderAll();
  }catch(e){toast(e.message);renderInspector();}
 }else if(input.matches('[data-note-entity]')){const t=target();if(inspect.type==='annotation')mutate(()=>t.entityIds=input.checked?[...new Set([...t.entityIds,input.dataset.noteEntity])]:t.entityIds.filter(id=>id!==input.dataset.noteEntity));
 }else if(input.matches('[data-participation]')){
  const id=input.dataset.participation;mutate(()=>{const key=show().actors.some(a=>a.id===id)?'castIds':'propIds';if(input.checked){song()[key].push(id);song().initial[id]||={x:0,y:0};}else song()[key]=song()[key].filter(x=>x!==id);});
 }else if(input.id==='focusActor'){focusActor=input.value;renderStage();renderRehearsal();}
 else if(input.id==='speed'){rate=Number(input.value);audio.playbackRate=rate;}
 else if(input.id==='showRoutes'||input.id==='showGrid'||input.id==='allRoutes')renderStage();
});
document.addEventListener('click',async ev=>{
 const el=ev.target.closest('[data-action],[data-song],[data-inspect],[data-entity],[data-lyric],[data-record],[data-issue]');if(!el)return;
 if(ev.target.matches('input,select,textarea'))return;
 if(el.dataset.action){$$('details.app-menu[open],details.stage-tools[open]').forEach(d=>d.open=false);try{await action(el.dataset.action);}catch(e){console.error(e);toast(e.message||tr('操作失败'));}return;}
 if(el.dataset.song){await switchSong(el.dataset.song);return;}
 if(el.dataset.inspect){inspectObject(el.dataset.inspect,el.dataset.id);return;}
 if(el.dataset.entity&&!el.closest('#stage')){inspectObject('entity',el.dataset.entity);return;}
 if(el.dataset.lyric){seekToLyric(el.dataset.lyric);return;}
 if(el.dataset.record){const r=JSON.parse(el.dataset.record);closeModal();if(r.showId!==showId)await switchShow(r.showId);if(r.songId&&r.songId!==songId)await switchSong(r.songId);rehearsal=false;if(r.time!=null)seek(r.time);inspectObject(r.type,r.id);renderAll();}
 if(el.dataset.issue!==undefined)locateIssue(+el.dataset.issue);
});
$('#closeDialog').onclick=closeModal;
$('#dialog').addEventListener('close',()=>{restoring=false;});
function svgPoint(e){const g=$('#scene');if(!g)return {x:0,y:0};const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(g.getScreenCTM().inverse());return{x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10};}
let drag=null;
$('#stage').addEventListener('pointerdown',ev=>{
 if(ev.button!==0)return;pause();const item=ev.target.closest('[data-entity]'),obj=ev.target.closest('[data-obj]'),handle=ev.target.closest('[data-handle]'),boundary=ev.target.closest('[data-boundary]'),bend=ev.target.closest('[data-bend]');
 if(item){const id=item.dataset.entity;singleStepEnd=null;if(ev.shiftKey)selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];else if(!selected.includes(id))selected=[id];inspect={type:selected.length>1?'group':'entity',id};if(rehearsal){focusActor=id;renderAll();return;}syncPlaybackContext();const positions={};for(const id of selected)positions[id]=C.clone(viewPosition(id));drag={kind:'entities',origin:svgPoint(ev),ids:[...selected],positions,base:C.clone(song()),started:false,readOnly:tool!=='initial'&&!selectedCue};}
 else if(bend&&!rehearsal){const move=selectedEvent()?.cue.moves.find(m=>m.id===bend.dataset.bend);if(!move)return;const index=+bend.dataset.segment,origin=svgPoint(ev);let t=.5,d=Infinity;for(let i=1;i<20;i++){const q=C.segment(move.points[index-1],move.points[index],i/20),distance=Math.hypot(q.x-origin.x,q.y-origin.y);if(distance<d){d=distance;t=i/20;}}inspect={type:'entity',id:move.entityId};selected=[move.entityId];drag={kind:'bend',origin,id:move.id,index,t,base:C.clone(move.points),started:false};}
 else if(handle&&!rehearsal){selectRouteHandle(handle.dataset.handle,false);drag={kind:'handle',origin:svgPoint(ev),handle:handle.dataset.handle,started:false};}
 else if(boundary&&!rehearsal)drag={kind:'boundary',origin:svgPoint(ev),handle:boundary.dataset.boundary,started:false};
 else if(obj&&obj.dataset.obj!=='stage'){inspectObject(obj.dataset.obj,obj.dataset.id);return;}
 else{if(rehearsal)return;drag={kind:'box',origin:svgPoint(ev),started:false,previous:ev.shiftKey?[...selected]:[]};if(!ev.shiftKey){selected=[];inspect={type:selectedCue?'cue':'song',id:selectedCue||songId};}}
 $('#stage').focus({preventScroll:true});$('#stage').setPointerCapture(ev.pointerId);renderInspector();renderStage();
});
$('#stage').addEventListener('pointermove',ev=>{
 if(!drag)return;const p=svgPoint(ev);let dx=p.x-drag.origin.x,dy=p.y-drag.origin.y;
 if(Math.abs(dx)+Math.abs(dy)<.25&&!drag.started)return;
 if(drag.readOnly){toast(tr('此处还没有步骤，先点「＋ 添加动作」。'));drag=null;return;}
 if(!drag.started){if(drag.kind!=='box')snapshot();drag.started=true;}
 if(drag.kind==='entities'){
  if(snapToGrid&&drag.ids.length){const first=drag.positions[drag.ids[0]];dx=Math.round(first.x+dx)-first.x;dy=Math.round(first.y+dy)-first.y;}
  const positions={};for(const id of drag.ids){const original=drag.positions[id];if(original)positions[id]={x:Math.round((original.x+dx)*10)/10,y:Math.round((original.y+dy)*10)/10};}
  const q=song();q.initial=C.clone(drag.base.initial);q.cues=C.clone(drag.base.cues);applyPositions(positions);
 }else if(drag.kind==='bend'){const move=selectedEvent()?.cue.moves.find(m=>m.id===drag.id);if(move){move.points=C.clone(drag.base);C.bendSegment(move.points,drag.index,dx,dy,drag.t);changed();}
 }else if(drag.kind==='handle'||drag.kind==='boundary'){
  const [i,key]=drag.handle.split(':');const points=drag.kind==='boundary'?show().stage.boundary:target()?.points;if(points){const dest=key==='point'?points[+i]:points[+i][key];dest.x=snapToGrid?Math.round(p.x):p.x;dest.y=snapToGrid?Math.round(p.y):p.y;changed();}
 }else {const lo={x:Math.min(p.x,drag.origin.x),y:Math.min(p.y,drag.origin.y)},hi={x:Math.max(p.x,drag.origin.x),y:Math.max(p.y,drag.origin.y)};selected=[...new Set([...drag.previous,...activeEntities().filter(e=>{const pos=viewPosition(e.id);return pos&&pos.x>=lo.x&&pos.x<=hi.x&&pos.y>=lo.y&&pos.y<=hi.y;}).map(e=>e.id)])];inspect={type:selected.length>1?'group':selected.length?'entity':'cue',id:selected.length===1?selected[0]:selectedCue};}
 renderStage();
 if(drag.kind==='box')$('#scene').insertAdjacentHTML('beforeend',`<rect x="${Math.min(p.x,drag.origin.x)}" y="${Math.min(p.y,drag.origin.y)}" width="${Math.abs(dx)}" height="${Math.abs(dy)}" fill="#9c7b3520" stroke="#9c7b35" stroke-width=".3"/>`);
});
$('#stage').addEventListener('pointerup',()=>{if(!drag)return;const moved=drag.started;drag=null;if(moved)renderAll();else{renderStage();renderInspector();renderEditorBar();}});
$('#stage').addEventListener('pointercancel',()=>{drag=null;renderAll();});
for(const [id,axis,prop,min,max,invert] of [['leftSplit','x','--left',130,420,false],['rightSplit','x','--right',230,520,true],['bottomSplit','y','--bottom',160,600,true]])$('#'+id).addEventListener('pointerdown',e=>{e.preventDefault();const start=axis==='x'?e.clientX:e.clientY,initial=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(prop));const move=ev=>{const delta=(axis==='x'?ev.clientX:ev.clientY)-start;document.documentElement.style.setProperty(prop,Math.max(min,Math.min(max,initial+(invert?-delta:delta)))+'px');};const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);updatePlayhead();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up,{once:true});});

async function action(a){
 if(a==='play'){await play();return;}
 if(a==='seek-time'){goToTimeDialog();return;}
 if(a==='layout-stage'){toggleStageFocus();return;}
 if(a==='layout-timeline'){toggleTimelineHeight();return;}
 if(a.startsWith('left-')){leftTab=a.slice(5);renderLeft();return;}
 if(a==='bottom-lyrics'){setLyricsVisible(true);return;}
 if(a.startsWith('bottom-')){bottomTab=a.slice(7);renderBottom();return;}
 if(await editingAction(a))return;
 if(a==='timeline-follow-step'){const e=selectedEvent(),m=e?.cue.moves.find(m=>m.entityId===selected[0]);if(m)mutate(()=>{delete m.startOffset;delete m.duration;});return;}
 if(timelineAction(a))return;
 if(await audioAction(a))return;
 if(await lyricsAction(a))return;
 if(await humanAction(a))return;
 const q=song(),s=show(),t=target();
 switch(a){
 case 'library':libraryDialog();break;
 case 'open':openDialog();break;
 case 'save':await saveWork();break;
 case 'save-folder':await saveFolder();break;
 case 'export-all':await exportPackage(lib.shows);break;
 case 'reload':await reloadFolder();break;
 case 'export':exportDialog();break;
 case 'help':helpDialog();break;
 case 'search':searchDialog();break;
 case 'undo':undo();break;
 case 'redo':undo(true);break;
 case 'mode-edit':pause();rehearsal=false;stagePhase='end';renderAll();break;
 case 'mode-rehearse':pause();rehearsal=true;stagePhase='live';tool='select';focusActor=selected.find(id=>q.castIds.includes(id))||focusActor||q.castIds[0]||'';renderAll();break;
 case 'view':viewDialog();break;
 case 'issues':issuesDialog();break;
 case 'tool-select':tool='select';stagePhase='end';renderAll();break;
 case 'tool-initial':pause();rehearsal=false;tool='initial';current=0;selected=[];inspect={type:'song',id:songId};renderAll();break;
 case 'rotate':rotation=(rotation+90)%360;renderStage();break;
 case 'zoom-in':zoom=Math.min(3,zoom*1.2);renderStage();break;
 case 'zoom-out':zoom=Math.max(.5,zoom/1.2);renderStage();break;
 case 'zoom-reset':zoom=1;renderStage();break;
 case 'song-settings':case 'inspect-song':rehearsal=false;inspectObject('song',songId);break;
 case 'show-settings':rehearsal=false;inspectObject('show',showId);break;
 case 'stage-settings':rehearsal=false;inspectObject('stage',showId);break;
 case 'play':singleStepEnd=null;await play();break;
 case 'previous':nextStep(-1);break;
 case 'next':nextStep(1);break;
 case 'loop':loopDialog();break;
 case 'playback-settings':playbackDialog();break;
 case 'toggle-step-pauses':setStepPauses(!stepPausesEnabled());break;
 case 'audio':$('#audioInput').click();break;
 case 'lyrics':lyricsDialog();break;
 case 'add-cue':createNextStep();break;
 case 'add-actor':addEntity(false);break;
 case 'add-prop':addEntity(true);break;
 case 'add-song':{const name=prompt(tr('曲目名称'));if(!name?.trim())return;const n=C.newSong(name.trim());mutate(()=>s.songs.push(n),false);await switchSong(n.id);break;}
 case 'duplicate-song':{const n=C.clone(q);n.id=C.id('song');n.title+=tr(' · 副本');if(q.audio){const f=await resourceFile(keyPath()+q.audio.file);if(f)pendingAssets.set(`shows/${s.id}/songs/${n.id}/${n.audio.file}`,f);}mutate(()=>s.songs.splice(s.songs.indexOf(q)+1,0,n),false);await switchSong(n.id);break;}
 case 'delete-song':if(s.songs.length===1){toast(tr('每场演出至少保留一个曲目。'));break;}if(confirm(tr('删除此曲目及其走台？可通过撤销恢复。'))){mutate(()=>s.songs=s.songs.filter(x=>x.id!==q.id),false);await switchSong(s.songs[0].id);}break;
 case 'delete-show':if(lib.shows.length===1){toast(tr('演出库至少保留一场演出。'));break;}if(confirm(tr('删除这场演出？可通过撤销恢复。'))){mutate(()=>lib.shows=lib.shows.filter(x=>x.id!==s.id),false);await switchShow(lib.shows[0].id);}break;
 case 'delete-entity':if(confirm(tr('从演出名单及所有曲目删除这个对象和它的路线？可撤销。'))){mutate(()=>{s.actors=s.actors.filter(x=>x.id!==t.id);s.props=s.props.filter(x=>x.id!==t.id);for(const song of s.songs){song.castIds=song.castIds.filter(x=>x!==t.id);song.propIds=song.propIds.filter(x=>x!==t.id);delete song.initial[t.id];for(const c of song.cues)c.moves=c.moves.filter(m=>m.entityId!==t.id);for(const n of song.annotations)n.entityIds=(n.entityIds||[]).filter(id=>id!==t.id);}},false);inspect={type:'song',id:q.id};selected=[];renderAll();}break;
 case 'delete-cue':deleteCurrentStep();break;
 case 'duplicate-cue':duplicateCurrentStep();break;
 case 'cue-up':case 'cue-down':reorderCurrentStep(a==='cue-up'?-1:1);break;
 case 'delete-move':mutate(()=>{const owner=q.cues.find(c=>c.moves.some(m=>m.id===t.id));if(owner)C.removeActions(q,owner.id,[t.entityId],linkNext);},false);inspectObject('cue',selectedCue);renderAll();break;
 case 'route-straight':mutate(()=>t.points.forEach(p=>{delete p.c1;delete p.c2;}));break;
 case 'route-curve':mutate(()=>{for(let i=1;i<t.points.length;i++){const b=t.points[i],a=t.points[i-1],dx=b.x-a.x,dy=b.y-a.y;b.c1={x:a.x+dx/3-dy*.2,y:a.y+dy/3+dx*.2};b.c2={x:a.x+dx*2/3-dy*.2,y:a.y+dy*2/3+dx*.2};}});break;
 case 'route-add':insertSelectedRoutePoint();break;
 case 'add-lyric':{const l={id:C.id('lyric'),start:current,end:current+4,text:tr('新的一句歌词'),notes:''};mutate(()=>q.lyrics.push(l),false);inspectObject('lyric',l.id);renderAll();break;}
 case 'delete-lyric':mutate(()=>q.lyrics=q.lyrics.filter(l=>l.id!==t.id),false);inspect={type:'song',id:q.id};renderAll();break;
 case 'add-annotation':{const n={id:C.id('note'),title:tr('排练记录'),start:null,end:null,entityIds:[...selected],notes:''};mutate(()=>q.annotations.push(n),false);inspectObject('annotation',n.id);renderAll();break;}
 case 'delete-annotation':mutate(()=>q.annotations=q.annotations.filter(n=>n.id!==t.id),false);inspect={type:'song',id:q.id};renderAll();break;
 case 'entity-records':actorRecords(t.id);break;
 case 'actor-records':actorRecords(focusActor);break;
 case 'add-anchor':mutate(()=>s.stage.anchors.push({id:C.id('mark'),name:tr('新标记'),kind:'mark',x:0,y:0,notes:''}),false);inspectObject('anchor',s.stage.anchors.at(-1).id);break;
 case 'add-wall':mutate(()=>s.stage.walls.push({id:C.id('wall'),name:tr('新墙'),points:[{x:-10,y:-20},{x:10,y:-20}],notes:''}),false);inspectObject('wall',s.stage.walls.at(-1).id);break;
 case 'add-backstage':mutate(()=>s.stage.backstage.push({id:C.id('back'),name:tr('新后台'),points:[{x:-20,y:-55},{x:20,y:-55},{x:20,y:-35},{x:-20,y:-35}],notes:''}),false);inspectObject('backstage',s.stage.backstage.at(-1).id);break;
 case 'delete-stage-object':{const key={anchor:'anchors',wall:'walls',backstage:'backstage'}[inspect.type];mutate(()=>s.stage[key]=s.stage[key].filter(x=>x.id!==t.id),false);inspectObject('stage',s.id);renderAll();break;}
 case 'stage-json':jsonStageDialog();break;
 case 'shift-times':shiftDialog();break;
 case 'remove-audio':if(q.audio){mutate(()=>q.audio=null,false);await loadAudio();renderAll();}break;
 }
}
function libraryDialog(){modal(tr('演出库'),ui`<div class="row"><span class="muted">每场演出独立保存舞台、角色、道具与曲目。</span><span class="spacer"></span><button id="newShow" class="gold">＋ 新建演出</button></div><div class="librarygrid" style="margin-top:18px">`+lib.shows.map((s,i)=>ui`<div class="librarycard ${s.id===showId?'active':''}" data-library-show="${esc(s.id)}"><div class="eyebrow">PRODUCTION ${String(i+1).padStart(2,'0')}</div><h3>${esc(s.title)}</h3><p class="muted">${s.songs.length} 首曲目 · ${s.actors.length} 位角色</p><span class="tag">LOCAL / OFFLINE</span></div>`).join('')+'</div>');$('#newShow').onclick=()=>{const title=prompt(tr('演出名称'));if(!title?.trim())return;const s=C.newShow(title.trim());mutate(()=>lib.shows.push(s),false);closeModal();switchShow(s.id);};$$('[data-library-show]').forEach(el=>el.onclick=()=>{closeModal();switchShow(el.dataset.libraryShow);});}
function actorRecords(id){const name=displayName(entity(id)),rows=records().filter(r=>r.showId===showId&&(!r.songId||r.songId===songId)&&(!r.entityIds.length||r.entityIds.includes(id)));const moves=C.events(song()).flatMap(e=>e.cue.moves.filter(m=>m.entityId===id).map(m=>({showId,songId,type:'move',id:m.id,label:e.cue.title+' · '+fmt(C.moveEvent(e,m).start)+' → '+fmt(C.moveEvent(e,m).end),notes:m.notes||e.cue.notes||tr('按舞台路线移动'),time:C.moveEvent(e,m).start,entityIds:[id]})));modal(name+tr(' · 本曲目完整记录'),[...moves,...rows.filter(r=>r.type!=='move')].map(recordHTML).join('')||tr('<div class="empty">还没有为此角色添加走台或备注。</div>'));}
function searchDialog(){modal(tr('检索整个演出库'),ui`<input id="searchInput" class="full" placeholder="角色、歌词、动作、道具或任意备注关键词"><div id="searchResults"></div>`);const input=$('#searchInput');input.oninput=()=>{const term=input.value.trim().toLowerCase();$('#searchResults').innerHTML=term?records().filter(r=>(r.label+' '+r.notes).toLowerCase().includes(term)).map(recordHTML).join('')||tr('<div class="empty">没有匹配的记录。</div>'):tr('<div class="empty">搜索所有演出里的备注，点击结果跳回对应对象。</div>');};input.oninput();input.focus();}
function issueContext(issue){
 const events=C.events(song()),event=events.find(e=>e.cue.id===issue.id||e.cue.moves.some(m=>m.id===issue.id)),move=event?.cue.moves.find(m=>m.id===issue.id),actor=entity(move?.entityId||issue.id),span=move?C.moveEvent(event,move):event;
 let text=issue.text;for(const en of activeEntities())text=text.replace('：'+en.id,'：'+en.name);
 const names={song:song().title,stage:tr('舞台'),show:show().title,lyric:tr('歌词'),annotation:tr('排练记录')};
 return {event,move,span,text,label:[event?ui`第 ${events.indexOf(event)+1} 步 · ${event.cue.title}`:names[issue.type]||tr('舞台对象'),actor?.name,span?`${fmt(span.start)} → ${fmt(span.end)}`:''].filter(Boolean).join(' · ')};
}
function locateIssue(index){
 const issue=issuesCache[index];if(!issue)return;const context=issueContext(issue);pause();singleStepEnd=null;closeModal();rehearsal=false;
 if(context.span)positionMusicCursor(context.span.start);
 if(issue.type==='entity'){tool='initial';stagePhase='start';}
 inspectObject(issue.type,issue.id);$('#workspace').classList.add('show-right');$('#inspector').scrollTop=0;renderAll();
}
function issuesDialog(){pause();issuesCache=C.issues(show(),song());modal(tr('本曲目检查'),ui`<p class="context-tip">已暂停播放。点击一项，直接修改对应演员的路线或时间。</p>`+issuesCache.map((i,n)=>{const c=issueContext(i);return ui`<button class="issue full ${i.level==='warning'?'warn':''}" data-issue="${n}"><b>${esc(c.label)}</b><span>${esc(c.text)}</span><small>定位并修改 →</small></button>`;}).join('')+(issuesCache.length?'':tr('<div class="empty">✓ 当前曲目未发现编排错误</div>')));}
function viewDialog(){modal(tr('调整工作区'),ui`<div class="stack"><label><input type="checkbox" id="viewLeft" ${!$('#workspace').classList.contains('noleft')?'checked':''}> 曲目／角色／道具列表</label><label><input type="checkbox" id="viewRight" ${!$('#workspace').classList.contains('noright')?'checked':''}> 详情、备注与演员提示</label><label><input type="checkbox" id="viewBottom" ${!$('#workspace').classList.contains('nobottom')?'checked':''}> 时间轴和歌词区域</label></div><p class="footer-note">拖动面板之间的分隔线调整大小。隐藏面板后，舞台自动占据释放的空间。隐藏时间轴时仍可用空格播放／暂停，方向键逐步查看。</p><button id="viewReset">恢复默认布局</button>`);for(const [id,cls]of [['viewLeft','noleft'],['viewRight','noright'],['viewBottom','nobottom']])$('#'+id).onchange=e=>$('#workspace').classList.toggle(cls,!e.target.checked);$('#viewReset').onclick=()=>{$('#workspace').className='workspace';document.documentElement.style.removeProperty('--left');document.documentElement.style.removeProperty('--right');document.documentElement.style.removeProperty('--bottom');stageFocusPrevious=null;timelineHeightPrevious=null;updateLayoutControls();closeModal();renderStage();if(bottomTab==='timeline')renderTimeline();};}
function loopDialog(){modal(tr('局部循环'),ui`<div class="two"><label class="field"><span>开始秒数</span><input id="loopStart" type="number" min="0" step=".1" value="${loop?.start||current}"></label><label class="field"><span>结束秒数</span><input id="loopEnd" type="number" min="0" step=".1" value="${loop?.end||Math.min(time(),current+12)}"></label></div><div class="dialogactions"><button id="clearLoop">关闭循环</button><button id="setLoop" class="gold">启用循环</button></div>`);$('#clearLoop').onclick=()=>{loop=null;closeModal();updateTransport();};$('#setLoop').onclick=()=>{const start=+$('#loopStart').value,end=+$('#loopEnd').value;if(!(end>start&&start>=0&&end<=time()))return toast(tr('结束时间需大于开始时间，且在本曲目范围内。'));loop={start,end};seek(start);closeModal();updateTransport();};}
function playbackDialog(){modal(tr('排练播放设置'),ui`<label class="smallcheck"><input type="checkbox" id="modalStepPauses" ${stepPausesEnabled()?'checked':''}>允许步骤结束后暂停</label><p class="footer-note">关闭后，本场所有曲目连续播放；各步骤原有的暂停设置会保留。「预览本步」仍在本步结束时停止。</p><label class="field"><span>播放速度</span><select id="modalSpeed">${[.5,.75,1,1.25,1.5].map(v=>`<option value="${v}" ${rate===v?'selected':''}>${v}×</option>`).join('')}</select></label><label class="field"><span>开始前倒数</span><select id="modalLead">${[0,3,5].map(v=>`<option value="${v}" ${+$('#leadIn').value===v?'selected':''}>${v?v+tr(' 秒'):tr('无')}</option>`).join('')}</select></label><button data-action="loop">设置局部循环</button>`);$('#modalStepPauses').onchange=e=>setStepPauses(e.target.checked);$('#modalSpeed').onchange=e=>{rate=+e.target.value;audio.playbackRate=rate;$('#speed').value=rate;};$('#modalLead').onchange=e=>$('#leadIn').value=e.target.value;}
function shiftDialog(){modal(tr('整体调整时间'),ui`<p class="muted">移动指定秒数之后的走台、歌词和有时间的备注。只适用于按时间编排；不会剪辑或移动 MP3。</p><div class="two"><label class="field"><span>从多少秒开始</span><input id="shiftFrom" type="number" value="${current}" min="0"></label><label class="field"><span>移动多少秒（负数为提前）</span><input id="shiftBy" type="number" value="2" step=".1"></label></div><button id="applyShift" class="gold">应用调整</button>`);$('#applyShift').onclick=()=>{if(song().mode!=='timed')return toast(tr('先在曲目设置切换为按时间编排。'));const from=+$('#shiftFrom').value,by=+$('#shiftBy').value;mutate(()=>{for(const c of song().cues)if(c.at>=from)c.at=Math.max(0,c.at+by);for(const l of song().lyrics){if(l.start>=from){l.start=Math.max(0,l.start+by);l.end=Math.max(l.start,l.end+by);}}for(const n of song().annotations)if(n.start!=null&&n.start>=from){n.start=Math.max(0,n.start+by);if(n.end!=null)n.end=Math.max(n.start,n.end+by);}});closeModal();};}
function jsonStageDialog(){modal(tr('舞台坐标文本'),ui`<p class="muted">直线节点使用 x、y；曲线目标节点额外包含 c1、c2 两个控制点。此舞台由本场所有曲目共用。</p><textarea id="stageJSON" class="importarea" style="height:350px">${esc(JSON.stringify(show().stage,null,2))}</textarea><div class="dialogactions"><button id="applyStage" class="gold">应用舞台</button></div>`);$('#applyStage').onclick=()=>{try{const stage=JSON.parse($('#stageJSON').value),temp=C.clone(lib);temp.shows.find(s=>s.id===showId).stage=stage;C.checkStructure(temp);mutate(()=>show().stage=stage);closeModal();}catch(e){toast(e.message);}};}
function parseLyrics(text){
 const trimmed=text.trim();if(trimmed.startsWith('[')||trimmed.startsWith('{')){try{const parsed=JSON.parse(trimmed),list=Array.isArray(parsed)?parsed:parsed.lyrics;if(!Array.isArray(list))throw Error(tr('JSON 需要歌词数组。'));return list.map((l,i)=>{if(!C.finite(l.start)||!C.finite(l.end)||l.start<0||l.end<l.start)throw Error(tr('第 ')+(i+1)+tr(' 句时间无效。'));return{id:l.id||C.id('lyric'),start:l.start,end:l.end,text:String(l.text||''),notes:l.notes||''};});}catch(e){if(trimmed.startsWith('{')||/^\[\s*\{/.test(trimmed))throw e;}}
 const parsed=[];for(const line of trimmed.split(/\r?\n/).filter(x=>x.trim())){
  const m=line.match(/^\s*\[?\s*(\d+(?:\.\d+)?)\s*(?:-->|[-–—,，~]|\s+)\s*(\d+(?:\.\d+)?)\s*\]?\s*(?:[|｜:]\s*)?(.*)$/);
  if(!m)throw Error(tr('无法识别此行：')+line.slice(0,50)+tr('。请用“12.3 - 16.8 | 歌词”或 JSON。'));if(+m[2]<+m[1])throw Error(tr('歌词结束时间不能早于开始时间。'));parsed.push({id:C.id('lyric'),start:+m[1],end:+m[2],text:m[3].trim(),notes:''});
 }return parsed;
}
function lyricsDialog(){modal(tr('导入逐句歌词'),ui`<p class="muted">粘贴 AI 对好的歌词。每行格式：<code>12.3 - 16.8 | 这一句歌词</code><br>也接受 JSON：<code>[{"start":12.3,"end":16.8,"text":"这一句歌词"}]</code></p><textarea id="lyricsText" class="importarea" placeholder="0 - 4.5 | 第一句歌词\n4.5 - 9.2 | 第二句歌词"></textarea><div class="dialogactions"><button id="chooseLyrics">选择 TXT / JSON 文件</button><button id="applyLyrics" class="gold">替换本曲目歌词</button></div><p class="footer-note">已有歌词会被替换，可撤销；走台不会改变。没有音频时也能按秒数静音演示。</p>`);$('#chooseLyrics').onclick=()=>$('#lyricsInput').click();$('#applyLyrics').onclick=()=>{try{const list=parseLyrics($('#lyricsText').value);mutate(()=>song().lyrics=list);closeModal();setLyricsVisible(true);renderLyricsDock(true);}catch(e){toast(e.message);}};}
$('#lyricsInput').onchange=async e=>{const f=e.target.files[0];if(f&&$('#lyricsText'))$('#lyricsText').value=await f.text();e.target.value='';};

