/* Local rehearsal handoff. Source notes remain the only copy of their text. */
function handoffStatusText(s=show()){
 return tr(({unlabelled:'尚未标注资料版次',same:'与此版走台数据一致',changed:'此版之后有修改'})[C.handoffState(s)]);
}
function renderHandoff(){
 const badge=$('#handoffBadge');if(!badge||!show())return;
 badge.classList.toggle('hidden',!show().handoff);
 badge.textContent=show().handoff?`${show().handoff.label} · ${handoffStatusText()}`:'';
 badge.title=show().handoff?`${show().handoff.label} · ${show().handoff.id}\n${show().handoff.summary}`:'';
 badge.classList.toggle('warning',C.handoffState(show())==='changed');
}
function handoffDetailsHTML(s=show()){
 const h=s.handoff;if(!h)return ui`<p>尚未标注资料版次</p>`;
 return `<h3>${esc(h.label)}</h3><p class="muted">${esc(versionDate(h.createdAt))} · ${esc(h.id.slice(-6))}</p><p class="handoff-summary">${esc(h.summary||tr('未填写改动摘要'))}</p><p>${esc(handoffStatusText(s))}</p>`;
}
function handoffDialog(){
 modal(tr('资料版次'),handoffDetailsHTML()+ui`<p class="footer-note">版次标记用于核对这份文件；离线无法判断全团使用的是哪一版。</p><p class="footer-note">软件版本</p><p>${esc(PAYLOAD.appVersion||'9.2.0')}</p>`);
}
function versionDate(value){return new Date(value).toLocaleString(StageI18n.language==='en'?'en-GB':StageI18n.language==='zh-TW'?'zh-TW':'zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function versionSnapshot(s,label,summary=''){
 const copy=C.clone(s);delete copy.versions;
 return {id:C.id('version'),label,summary,createdAt:new Date().toISOString(),snapshot:copy};
}
async function captureVersion(s,label,summary=''){
 const version=versionSnapshot(s,label,summary),assets=new Map(),missing=[];
 for(const q of version.snapshot.songs)if(q.audio){
  const file=await resourceFile(`shows/${s.id}/songs/${q.id}/${q.audio.file}`);
  if(!file){missing.push(q.title);continue;}
  const bytes=new Uint8Array(await file.arrayBuffer());let hash;
  if(globalThis.crypto?.subtle)hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  else {let a=2166136261,b=5381;for(const n of bytes){a=Math.imul(a^n,16777619);b=Math.imul(b,33)^n;}hash=(a>>>0).toString(16)+(b>>>0).toString(16)+'-'+bytes.length;}
  q.audio.file=`assets/version-${hash}.mp3`;assets.set(`shows/${s.id}/songs/${q.id}/${q.audio.file}`,file);
 }
 if(missing.length)version.missingAudio=missing;
 return {version,assets};
}
function versionsDialog(){
 pause();const versions=[...(show().versions||[])].reverse();
 modal(tr('版本记录'),ui`<p class="context-tip">需要时手动留一版，方便追溯。普通保存不会增加记录。</p><button id="keepVersion" class="gold">保存当前为一个版本</button><p class="footer-note">历史随“保存”的演出包保留；“发给演员”默认只带当前版本。</p><div id="versionItems">`+versions.map(v=>`<article class="session-note"><h3>${esc(v.label||tr('未命名版本'))}</h3><small>${esc(versionDate(v.createdAt))}</small>${v.summary?`<p class="note-text">${esc(v.summary)}</p>`:''}<button data-version-view="${esc(v.id)}">${tr('查看详情')}</button></article>`).join('')+(versions.length?'':tr('<p class="empty">还没有版本记录。需要留下排练节点时，再保存一版即可。</p>'))+'</div>');
 $('#keepVersion').onclick=()=>{
  modal(tr('保存一个版本'),ui`<form id="versionForm"><label class="field"><span>版本名称（可空）</span><input id="versionLabel" aria-label="版本名称（可空）" maxlength="120"></label><label class="field"><span>说明（可空）</span><textarea id="versionSummary" aria-label="说明（可空）" maxlength="6000"></textarea></label><p class="context-tip">自动记录保存日期和时间。</p><div class="dialogactions"><button type="button" id="versionCancel">取消</button><button type="submit" class="gold">留下这一版</button></div></form>`);
  $('#versionCancel').onclick=versionsDialog;$('#versionForm').onsubmit=async e=>{
   e.preventDefault();if($('#versionForm').dataset.busy)return;$('#versionForm').dataset.busy='true';
   const s=show(),label=$('#versionLabel').value.trim()||tr('排练稿'),summary=$('#versionSummary').value.trim();
   try{const saved=await captureVersion(s,label,summary);if(!lib.shows.includes(s))return;mutate(()=>{s.versions||=[];s.versions.push(saved.version);for(const [key,file]of saved.assets)pendingAssets.set(key,file);});versionsDialog();if(saved.version.missingAudio?.length)toast(tr('版本已保留；部分音乐未连接，详情中已标明。'));}
   catch(error){delete $('#versionForm').dataset.busy;toast(error.message);}
  };$('#versionLabel').focus();
 };
 $('#versionItems').onclick=e=>{const id=e.target.closest('[data-version-view]')?.dataset.versionView;if(id)versionDetails(id);};
}
function versionDetails(id){
 const v=show().versions?.find(v=>v.id===id);if(!v)return;const same=C.showFingerprint(v.snapshot)===C.showFingerprint(show());
 modal(tr('版本详情'),`<h3>${esc(v.label)}</h3><p>${esc(versionDate(v.createdAt))}</p><p class="note-text">${esc(v.summary)}</p>`+v.snapshot.songs.map(q=>`<p>${esc(q.title)} · ${esc(ui`${q.cues.length} 个步骤`)} · ${esc(ui`${q.castIds.length} 位角色`)}</p>`).join('')+(v.missingAudio?.length?`<p class="warning">${esc(tr('保存此版时未连接音乐：'))}${esc(v.missingAudio.join(' / '))}</p>`:'')+ui`<p class="footer-note">恢复前会自动保留当前内容，也可用撤销退回。</p><div class="row wrap"><button id="versionBack">返回记录</button><button id="versionExport">导出这一版</button><button id="versionRestore" class="gold" ${same?'disabled':''}>恢复这一版</button></div>`);
 $('#versionBack').onclick=versionsDialog;$('#versionExport').onclick=()=>exportPackage([v.snapshot],{archivedEdition:v});$('#versionRestore').onclick=()=>restoreVersion(id);
}
async function restoreVersion(id){
 const s=show(),v=s.versions?.find(v=>v.id===id);if(!v)return;
 const revision=editVersion,saved=await captureVersion(s,tr('恢复前自动保留'));if(revision!==editVersion||!lib.shows.includes(s))return toast(tr('内容刚有变化，请重新选择要恢复的版本。'));
 const restored=C.clone(v.snapshot);restored.versions=[...s.versions,saved.version];
 C.checkStructure({version:1,shows:[restored]});pause();snapshot();for(const [key,file]of saved.assets)pendingAssets.set(key,file);lib.shows[lib.shows.indexOf(s)]=restored;repairSelection();changed();closeModal();renderAll();await loadAudio();renderAll();toast(tr('已恢复历史版本；恢复前的内容也已保留。'));
}
const sessionStatusNames={discussion:'待讨论',decided:'已决定',checked:'现场已复核'};
let sessionFilter={person:'',from:'',to:''},sessionSelected=new Set();
function sessionSourceRef(r){return{showId:r.showId,sourceType:r.type,sourceId:r.id,songId:r.songId||null};}
function addSessionRef(ref){
 const s=lib.shows.find(s=>s.id===(ref.showId||showId));if(!s)return;
 const value={songId:ref.songId||null,sourceType:ref.sourceType,sourceId:ref.sourceId};
 if(!C.noteSource(s,value).notes.trim())return toast(tr('先写下备注，再加入清单。'));
 if(s.rehearsalList?.some(n=>n.sourceType===value.sourceType&&n.sourceId===value.sourceId&&n.songId===value.songId))return toast(tr('这条备注已在排练清单中。'));
 mutate(()=>{s.rehearsalList||=[];s.rehearsalList.push({id:C.id('rehearsal'),...value,status:'discussion'});});
 toast(tr('已加入排练清单；原备注仍可直接编辑。'));
}
function annotationVisibleForActor(a,id,time){
 const range=C.annotationRange(show(),song(),a);
 return !range.missing&&(!a.entityIds?.length||a.entityIds.includes(id))&&(range.start==null||range.start<=time)&&(range.end==null||range.end>=time);
}
function annotationInspector(t){
 const linked=show().rehearsalList?.find(n=>n.songId===songId&&n.sourceType==='annotation'&&n.sourceId===t.id&&n.cueId),range=C.annotationRange(show(),song(),t),extra='min="0" step="0.1"'+(linked?' disabled':'');
 return field(tr('记录标题'),'title',t.title)+(linked?`<p class="${range.missing?'warning':'context-tip'}">${esc(range.missing?tr('原备注或关联步骤已删除／清空'):tr('时间跟随关联步骤'))}</p><button data-action="session-unlink">${tr('解除步骤关联')}</button>`:'')+`<div class="two">${field(tr('开始秒数（可空）'),'start',range.start,'number',extra)}${field(tr('结束秒数（可空）'),'end',range.end,'number',extra)}</div>`+ui`<div class="field"><span>提醒谁（不选则提醒全体）</span><div class="people-checks">${activeEntities().map(en=>`<label><input type="checkbox" data-note-entity="${esc(en.id)}" ${t.entityIds?.includes(en.id)?'checked':''}>${esc(en.name)}</label>`).join('')}</div></div>`+notesField(t)+ui`<button class="danger full" data-action="delete-annotation">删除这条记录</button>`;
}
function unlinkSessionAnnotation(){
 const t=target(),ref=show().rehearsalList?.find(n=>n.sourceType==='annotation'&&n.sourceId===t?.id&&n.songId===songId&&n.cueId);if(!ref)return;
 const range=C.annotationRange(show(),song(),t);mutate(()=>{t.start=range.start;t.end=range.end;delete ref.cueId;});
}
function sessionRows(){
 const from=sessionFilter.from===''?null:Number(sessionFilter.from),to=sessionFilter.to===''?null:Number(sessionFilter.to);
 return (show().rehearsalList||[]).filter(n=>!n.songId||n.songId===songId).map(ref=>({ref,source:C.noteSource(show(),ref)})).filter(({source:r})=>
  (!sessionFilter.person||!r.entityIds.length||r.entityIds.includes(sessionFilter.person))&&
  (from==null||r.end==null||r.end>=from)&&(to==null||r.start==null||r.start<=to));
}
function sessionStateText(ref,source){return source.missing?tr('原备注或关联步骤已删除／清空'):source.stale?tr('需重新复核'):tr(sessionStatusNames[ref.status]);}
function sessionContext(source){
 const people=source.entityIds.length?source.entityIds.map(id=>displayName(entity(id))).join(' / '):tr('全体');
 return [source.song?.title,source.cue?.title,source.start==null?null:fmt(source.start)+(source.end==null?'':'–'+fmt(source.end)),people].filter(Boolean).join(' · ');
}
function openSessionList(person=''){
 pause();sessionFilter={person,from:'',to:''};sessionSelected=new Set(sessionRows().map(r=>r.ref.id));renderSessionList();
}
function renderSessionList(){
 const rows=sessionRows();
 modal(tr('本次排练清单'),ui`<p class="context-tip">沿用原备注；从笔记列表加入，或在当前位置记一条。当前只整理这首曲目及全场备注。</p><div class="session-filters"><label class="field"><span>给谁看</span><select id="sessionPerson" aria-label="给谁看"><option value="">${tr('全体')}</option>${activeEntities().map(e=>`<option value="${esc(e.id)}" ${sessionFilter.person===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></label><label class="field"><span>起始秒数（可空）</span><input id="sessionFrom" aria-label="起始秒数（可空）" type="number" min="0" step="0.1" value="${esc(sessionFilter.from)}"></label><label class="field"><span>结束秒数（可空）</span><input id="sessionTo" aria-label="结束秒数（可空）" type="number" min="0" step="0.1" value="${esc(sessionFilter.to)}"></label></div><p id="sessionRangeError" class="warning" role="status"></p><div class="row wrap"><button id="sessionApplyFilter">应用筛选</button><button id="newSessionNote">＋ 记排练笔记</button><button id="previewSession" class="gold">预览所选提示单</button></div><p class="footer-note">状态由你手动记录；修改相关曲目、舞台或笔记后，原复核标记会提示重新复核。</p><div id="sessionItems">`+
 rows.map(({ref,source:r})=>`<article class="session-note"><div class="row wrap"><label><input type="checkbox" data-session-selected="${esc(ref.id)}" ${sessionSelected.has(ref.id)?'checked':''}> ${esc(r.title||tr('排练记录'))}</label><span class="spacer"></span><select aria-label="${esc(tr('笔记状态')+' · '+(r.title||ref.id))}" data-session-status="${esc(ref.id)}">${Object.entries(sessionStatusNames).map(([value,label])=>`<option value="${value}" ${ref.status===value?'selected':''}>${esc(tr(label))}</option>`).join('')}</select></div><small>${esc(sessionContext(r))}</small><p class="${r.missing||r.stale?'warning':'session-state'}">${esc(sessionStateText(ref,r))}</p><p class="note-text">${esc(r.notes)}</p><div class="row wrap"><button data-session-open="${esc(ref.id)}" ${!r.obj?'disabled':''}>${tr('回到原备注')}</button>${r.stale&&!r.missing?`<button data-session-check="${esc(ref.id)}">${tr('重新记录现场复核')}</button>`:''}<button data-session-remove="${esc(ref.id)}">${tr('移出本次清单')}</button></div></article>`).join('')+(rows.length?'':tr('<p class="empty">还没有相关笔记。从下方笔记列表加入已有备注，或点击“记排练笔记”。</p>'))+'</div>');
 const filter=()=>{
  const from=$('#sessionFrom').value,to=$('#sessionTo').value;
  if((from!==''&&(!Number.isFinite(+from)||+from<0))||(to!==''&&(!Number.isFinite(+to)||+to<0))||(from!==''&&to!==''&&+to<+from)){$('#sessionRangeError').textContent=tr('请填写有效的起止时间。');$('#previewSession').disabled=true;return;}
  sessionFilter={person:$('#sessionPerson').value,from,to};sessionSelected=new Set(sessionRows().map(r=>r.ref.id));renderSessionList();
 };
 $('#sessionPerson').onchange=filter;$('#sessionApplyFilter').onclick=filter;
 $('#newSessionNote').onclick=newSessionNote;$('#previewSession').onclick=previewSession;
 $('#sessionItems').onchange=event=>{
  const input=event.target;
  if(input.dataset.sessionSelected){input.checked?sessionSelected.add(input.dataset.sessionSelected):sessionSelected.delete(input.dataset.sessionSelected);return;}
  const ref=show().rehearsalList?.find(n=>n.id===input.dataset.sessionStatus);if(!ref)return;
  mutate(()=>{ref.status=input.value;if(ref.status==='checked')ref.checkedFingerprint=C.noteSource(show(),ref).fingerprint;else delete ref.checkedFingerprint;});renderSessionList();
 };
 $('#sessionItems').onclick=async event=>{
  const button=event.target.closest('button');if(!button)return;
  const id=button.dataset.sessionOpen||button.dataset.sessionRemove||button.dataset.sessionCheck,ref=show().rehearsalList?.find(n=>n.id===id);if(!ref)return;
  if(button.dataset.sessionRemove){mutate(()=>{show().rehearsalList=show().rehearsalList.filter(n=>n!==ref);});sessionSelected.delete(id);renderSessionList();}
  else if(button.dataset.sessionCheck){mutate(()=>ref.checkedFingerprint=C.noteSource(show(),ref).fingerprint);renderSessionList();}
  else {const r=C.noteSource(show(),ref);closeModal();rehearsal=false;if(ref.songId&&ref.songId!==songId)await switchSong(ref.songId);if(r.start!=null)seek(r.start);if(r.cue)selectedCue=r.cue.id;inspectObject(ref.sourceType,ref.sourceId);renderAll();}
 };
}
function newSessionNote(){
 const event=selectedEvent(),who=selected.length?selected:sessionFilter.person?[sessionFilter.person]:[];
 modal(tr('记排练笔记'),ui`<p>${esc(song().title)} · ${esc(event?.cue.title||fmt(current))}</p><form id="sessionNoteForm"><label class="field"><span>排练笔记</span><textarea id="sessionNoteText" aria-label="排练笔记" required rows="5"></textarea></label><div class="people-checks">${activeEntities().map(e=>`<label><input type="checkbox" data-session-person="${esc(e.id)}" ${who.includes(e.id)?'checked':''}>${esc(e.name)}</label>`).join('')}</div><p class="footer-note">不选角色则提醒全体。新笔记先标为待讨论。</p><div class="dialogactions"><button type="button" id="sessionNoteCancel">取消</button><button type="submit" class="gold">加入清单</button></div></form>`);
 $('#sessionNoteCancel').onclick=renderSessionList;
 $('#sessionNoteForm').onsubmit=eventSubmit=>{
  eventSubmit.preventDefault();const text=$('#sessionNoteText').value.trim();if(!text){$('#sessionNoteText').focus();return;}
  const ids=$$('[data-session-person]:checked').map(i=>i.dataset.sessionPerson),a={id:C.id('note'),title:tr('排练记录'),start:event?.start??current,end:event?C.cuePlaybackEnd(event):null,entityIds:ids,notes:text};
  const ref={id:C.id('rehearsal'),songId,sourceType:'annotation',sourceId:a.id,status:'discussion',...(event?{cueId:event.cue.id}:{})};
  mutate(()=>{song().annotations.push(a);show().rehearsalList||=[];show().rehearsalList.push(ref);});sessionSelected.add(ref.id);renderSessionList();
 };$('#sessionNoteText').focus();
}
function selectedSessionRows(){return sessionRows().filter(r=>sessionSelected.has(r.ref.id));}
function sessionSheetBody(rows){
 const s=show(),h=s.handoff,person=entity(sessionFilter.person);
 return `<header><h1>${esc(tr('排练笔记提示单'))}</h1><h2>${esc(s.title)} · ${esc(song().title)}</h2><p>${esc(person?.name||tr('全体'))} · ${fmt(Number(sessionFilter.from)||0)}–${fmt(sessionFilter.to===''?C.total(song()):Number(sessionFilter.to))}</p><p>${esc(h?`${h.label} · ${h.id} · ${handoffStatusText(s)}`:tr('尚未标注资料版次'))}</p>${h?.summary?`<p class="note-text">${esc(h.summary)}</p>`:''}<p>${esc(tr('观众方向'))}：${esc(tr({south:'下侧',north:'上侧',west:'左侧',east:'右侧'}[s.stage.audience]))}</p><p>${esc(tr('具名入口'))}：${esc(s.stage.anchors.filter(a=>a.kind==='gate').map(a=>a.name).join(' / ')||'—')}</p></header>`+
 rows.map(({ref,source:r})=>`<article class="session-note"><h3>[${esc(sessionStateText(ref,r))}] ${esc(r.title||tr('排练记录'))}</h3><small>${esc(sessionContext(r))}</small><p class="note-text">${esc(r.notes||tr('原备注或关联步骤已删除／清空'))}</p></article>`).join('');
}
function sessionSheetHTML(rows){return `<!doctype html><html lang="${StageI18n.language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(tr('排练笔记提示单'))}</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#111;background:white;max-width:820px;margin:30px auto;padding:0 24px;overflow-wrap:anywhere}h1{font-size:26px}h2{font-size:20px}h3{font-size:17px;break-after:avoid}small{color:#444}.note-text{white-space:pre-wrap}.session-note{border-top:1px solid #999;margin:22px 0;padding-top:10px}header{border-bottom:2px solid #111}button{padding:8px 14px}@media print{body{max-width:none;margin:0;padding:0;font-size:11pt}button{display:none}h1,h2,h3{break-after:avoid}p{orphans:3;widows:3}.session-note{break-inside:auto}@page{size:auto;margin:16mm}}</style><button onclick="window.print()">${esc(tr('打印 / 保存为 PDF'))}</button>${sessionSheetBody(rows)}</html>`;}
function previewSession(){
 const rows=selectedSessionRows();if(!rows.length)return toast(tr('请先勾选要导出的笔记。'));
 modal(tr('提示单预览'),ui`<div class="row wrap"><button id="backToSession">返回清单</button><button id="downloadSession" class="gold">下载这份提示单</button></div><p class="footer-note">只包含当前筛选并勾选的笔记；演出包仍包含整场资料。</p><div class="session-preview">`+sessionSheetBody(rows)+'</div>');
 $('#backToSession').onclick=renderSessionList;
 // Capture the preview. Later edits cannot silently change this downloaded handoff.
 const sheet=sessionSheetHTML(rows),name=[show().title,song().title,entity(sessionFilter.person)?.name||tr('全体'),tr('排练笔记')].join('-').replace(/[\\/:*?"<>|]/g,'-');
 $('#downloadSession').onclick=()=>download(new Blob([sheet],{type:'text/html;charset=utf-8'}),name+'.html');
}
