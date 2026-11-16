/* Personal singing preferences stay in this browser. Only explicit lyric attribution is production data. */
let singingVocal=false;
let singingContext=null,singingIdentity='',singingSignature='',singingActive='',singingFollow=true,singingRoles=[],singingSize=30,singingLead=2,singingAnchor=null,singingRange=null;
let singingNotes=new Map();
const singingNotesKey=()=>'stagebook.singing-notes.'+showId+'/'+songId;
function loadSingingNotes(){
 singingNotes=new Map();
 try{
  const rows=JSON.parse(localStorage.getItem(singingNotesKey())||'[]');
  for(const row of rows)if(Array.isArray(row)&&typeof row[0]==='string'&&typeof row[1]?.text==='string')
   singingNotes.set(row[0],{mine:row[1].mine===true,text:row[1].text.slice(0,160)});
 }catch{}
}
function singingNoteDialog(id){
 const line=lyricById(id);
 if(!line)return;
 pause();
 const key=singingNotesKey(),previous=singingNotes.get(id);
 modal(tr('我的唱段备注'),ui`<p>${esc(line.text)}</p>
  <label class="smallcheck"><input id="singNoteMine" type="checkbox" ${!previous||previous.mine?'checked':''}>这句我唱</label>
  <label class="field"><span>小备注</span><textarea id="singNoteText" maxlength="160" rows="2" placeholder="例如：第二遍进，唱上声部">${esc(previous?.text||'')}</textarea></label>
  <div class="dialogactions">${previous?ui`<button id="clearSingNote">清除标记和备注</button>`:''}<button id="saveSingNote" class="gold">保存</button></div>`);
 const save=(mine,text)=>{
  if(key!==singingNotesKey())return;
  const next=new Map(singingNotes);
  if(mine||text)next.set(id,{mine,text});else next.delete(id);
  try{localStorage.setItem(key,JSON.stringify([...next]));}
  catch{toast(tr('这台浏览器无法保存个人备注。'));return;}
  singingNotes=next;singingSignature='';
  closeModal();
  renderSinging();
  document.querySelector(`[data-action="sing-note:${CSS.escape(id)}"]`)?.focus({preventScroll:true});
 };
 $('#saveSingNote').onclick=()=>save($('#singNoteMine').checked,$('#singNoteText').value.trim());
 if(previous)$('#clearSingNote').onclick=()=>save(false,'');
}
function singerKey(text){return String(text||'').normalize('NFKC').toLocaleLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function resolveSinger(label){
 const key=singerKey(label),actors=show()?.actors||[];
 const matches=actors.filter(a=>[a.id,a.name,a.label].some(v=>singerKey(v)===key));
 return matches.length===1?matches[0].id:'tag:'+key;
}
function labelSingers(label){
 const exact=resolveSinger(label);if(!exact.startsWith('tag:'))return [exact];
 return [...new Set(label.split(/\s*(?:[\/&,、，＋+]|\band\b)\s*/i).filter(s=>singerKey(s)).map(resolveSinger))];
}
function lyricSegments(l){
 const text=String(l.text||''),matches=[...text.matchAll(/\[([^\]\n]+)\]/g)];
 const explicit=Array.isArray(l.speakerIds)?l.speakerIds.filter(id=>typeof id==='string'):null;
 if(!matches.length)return [{text,roles:explicit||[]}];
 const result=[];if(matches[0].index)result.push({text:text.slice(0,matches[0].index),roles:explicit||[]});
 matches.forEach((m,i)=>result.push({text:text.slice(m.index,matches[i+1]?.index??text.length),roles:explicit||labelSingers(m[1])}));return result;
}
function singingLineIsMine(l){return singingNotes.get(l.id)?.mine===true||lyricSegments(l).some(segment=>segment.roles.some(id=>singingRoles.includes(id)));}
function singingRoleOptions(){
 const options=new Map((show()?.actors||[]).filter(a=>song()?.castIds.includes(a.id)).map(a=>[a.id,{id:a.id,name:displayName(a)}]));
 for(const l of song()?.lyrics||[])for(const m of String(l.text).matchAll(/\[([^\]\n]+)\]/g))for(const label of m[1].split(/\s*(?:[\/&,、，＋+]|\band\b)\s*/i)){
  if(!singerKey(label))continue;const id=resolveSinger(label);if(!options.has(id))options.set(id,{id,name:entity(id)?.name||label.trim()});
 }
 for(const l of song()?.lyrics||[])for(const id of l.speakerIds||[]){const actor=show().actors.find(a=>a.id===id);if(actor&&!options.has(id))options.set(id,{id,name:displayName(actor)});}
 return [...options.values()];
}
function singingPrefsKey(){return 'stagebook.singing.'+showId;}
function loadSingingPrefs(){
 singingRoles=[];singingSize=30;singingLead=2;
 try{const p=JSON.parse(localStorage.getItem(singingPrefsKey())||'{}');if(Array.isArray(p.roles))singingRoles=p.roles.filter(id=>typeof id==='string');if([24,30,38].includes(p.size))singingSize=p.size;if([0,2,4].includes(p.lead))singingLead=p.lead;}catch{}
}
function saveSingingPrefs(){try{localStorage.setItem(singingPrefsKey(),JSON.stringify({roles:singingRoles,size:singingSize,lead:singingLead}));}catch{}}
function singingSongWillChange(){vocalStop(true);loop=null;singingRange=null;singingAnchor=null;}
function enterSinging(){
 if(singing)return;
 singingContext={identity:showId+'/'+songId,rehearsal,tool,stagePhase,selected:[...selected],selectedCue,inspect:{...inspect},bottomTab,lyricDockVisible,loop:loop&&{...loop},lead:$('#leadIn').value};
 singleStepEnd=null;loop=null;singingRange=null;singing=true;rehearsal=true;stagePhase='live';tool='select';$('#leadIn').value='0';singingFollow=true;singingIdentity='';renderAll();
}
function exitSinging(mode=null){
 if(!singing)return;
 if(singingPresentation.active())void singingPresentation.exit();vocalStop(true);singingVocal=false;document.body.classList.remove('vocal-mode');const context=singingContext;singing=false;singingRange=null;singingAnchor=null;loop=null;
 if(context&&context.identity===showId+'/'+songId){rehearsal=context.rehearsal;tool=context.tool;stagePhase=context.stagePhase;selected=context.selected;selectedCue=context.selectedCue;inspect=context.inspect;bottomTab=context.bottomTab;lyricDockVisible=context.lyricDockVisible;loop=context.loop;$('#leadIn').value=context.lead;}
 else{const at=current;rehearsal=false;prepareHumanScene();positionMusicCursor(at);if(context)$('#leadIn').value=context.lead;}
 if(mode!==null){rehearsal=mode==='mode-rehearse';tool='select';stagePhase=rehearsal?'live':'end';}
 singingContext=null;renderAll();
 if(mode===null)$('#singMode').focus();
}
function renderSinging(){
 $('#workspace').classList.toggle('singing',singing);document.body.classList.toggle('singing-mode',singing);$('#singingPanel').classList.toggle('hidden',!singing);$('#singMode').classList.toggle('selected',singing);$('#singMode').setAttribute('aria-pressed',String(singing));
 if(!singing)return;
 if(!song()?.vocalPractice?.clips.length){vocalStop(true);singingVocal=false;}
 const identity=showId+'/'+songId;if(identity!==singingIdentity){singingIdentity=identity;singingSignature='';singingActive='';singingAnchor=null;singingFollow=true;loadSingingPrefs();loadSingingNotes();}
 const roles=singingRoleOptions(),names=roles.filter(r=>singingRoles.includes(r.id)).map(r=>r.name).join(' / ');
 const hasLyrics=!!song().lyrics.length,hasMyLines=song().lyrics.some(singingLineIsMine);
 const songs=show().songs.map(q=>`<option value="${esc(q.id)}" ${q.id===songId?'selected':''}>${esc(q.title)}</option>`).join('');
 $('#singingTools').innerHTML=ui`
  <div class="singing-title">
   <label><span>练歌曲目</span><select id="singingSong" aria-label="练歌曲目">${songs}</select></label>
   <button id="singVocalMode" data-action="sing-vocal">和声练习</button>
   <button id="singingFullscreen" data-action="sing-fullscreen" title="全屏" aria-label="全屏" aria-pressed="false"><span aria-hidden="true">⛶</span></button>
   <button class="practice-close" data-action="sing-exit" title="返回工作区" aria-label="返回工作区">×</button>
  </div>
  <div class="singing-options">
   ${roles.length&&hasLyrics?`<button data-action="sing-roles" class="sing-role-button">${names?esc(names):tr('选择我负责的角色')}</button>`:''}
   ${hasMyLines?ui`<div class="singing-line-nav">
    <button data-action="sing-previous" title="上一句我的词" aria-label="上一句我的词">←</button>
    <button data-action="sing-next" title="下一句我的词" aria-label="下一句我的词">→</button>
   </div>`:''}
   ${hasLyrics?ui`<button data-action="sing-passage">循环练习</button>
    <button id="singingFollow" data-action="sing-follow" ${singingFollow?'hidden':''}>回到当前句</button>`:''}
   <button class="singing-preferences" data-action="sing-settings" title="练歌设置" aria-label="练歌设置"><span aria-hidden="true">⚙</span></button>
  </div>
  <div id="singingLoopState" class="singing-loop-state"></div>`;
 syncSingingFullscreen();
 const vocalButton=document.querySelector('#singVocalMode');
 if(vocalButton){
  vocalButton.hidden=!song()?.vocalPractice?.clips.length;
  vocalButton.setAttribute('aria-pressed',String(singingVocal));
  vocalButton.textContent=tr(singingVocal?'返回歌词':'和声练习');
  document.body.classList.toggle('vocal-mode',singingVocal);
 }
 if(singingVocal){renderVocalPractice();return;}
 $('#vocalPractice').classList.add('hidden');
 $('#singingList').classList.remove('hidden');
 $('#singingContext').classList.toggle('hidden',!song().lyrics.length);
 if(!song().lyrics.length)$('#singingList').style.setProperty('--lyric-edge','0px');
 $('#singingList').style.setProperty('--sing-font',singingSize+'px');
 const signature=JSON.stringify([song().lyrics,singingRoles,StageI18n.language]);
 if(signature!==singingSignature){
  $('#singingList').innerHTML=sortedSingingLyrics().map(line=>{
   const id=esc(line.id),personal=singingNotes.get(line.id),mine=singingLineIsMine(line);
   const words=lyricSegments(line).map(segment=>`<span class="${personal?.mine||segment.roles.some(id=>singingRoles.includes(id))?'my-words':''}">${esc(segment.text)}</span>`).join('');
   const singers=line.speakerIds?.map(id=>esc(entity(id)?.name||id)).join(' / ');
   return ui`<article class="sing-line ${mine?'my-line':''}" data-sing-row="${id}">
    <div class="sing-line-head">
     <time>${fmt(line.start)}</time><span class="sing-line-badge">${mine?tr('我的词'):''}</span>
     <div class="sing-line-actions">
      <button data-action="sing-loop:${id}">循环这句</button>
      <button class="sing-note-button ${personal?'has-note':''}" data-action="sing-note:${id}">${personal?tr('改备注'):tr('我的备注')}</button>
     </div>
     <button class="sing-line-options" title="本句操作" aria-label="本句操作" data-action="sing-line-menu:${id}">•••</button>
    </div>
    <button class="sing-line-text" data-action="sing-jump:${id}">${words}</button>
    ${singers?`<small class="sing-attribution">${singers}</small>`:''}
    ${personal?.text?`<small class="sing-personal-note">${esc(personal.text)}</small>`:''}
   </article>`;
  }).join('')||ui`<div class="singing-empty"><p>先导入带时间的歌词，即可开始练歌。</p><button class="gold" data-action="lyrics">导入歌词</button></div>`;
  singingSignature=signature;singingActive='';
 }
 updateSingingFocus(true);
}
function sortedSingingLyrics(){return [...song().lyrics].sort((a,b)=>a.start-b.start||a.end-b.end);}
function updateSingingFocus(force=false){
 if(!singing||singingVocal)return;$('#singingPanel').classList.toggle('singing-playing',playing);const list=sortedSingingLyrics(),active=list.filter(l=>l.start<=current&&l.end>current),key=active.map(l=>l.id).join('|');
 if(key!==singingActive||force){
  for(const row of $$('[data-sing-row]')){const on=active.some(l=>l.id===row.dataset.singRow);row.classList.toggle('active',on);row.setAttribute('aria-current',String(on));}
  const chosen=active.find(singingLineIsMine)||active[0]||list.find(l=>l.start>current)||list.at(-1);
  if(singingFollow&&chosen){
   const pane=$('#singingList');
   if(!playing&&current===0&&!singingAnchor){pane.style.setProperty('--lyric-edge','0px');pane.scrollTop=0;}
   else centerLyricRow(pane,$$('[data-sing-row]').find(row=>row.dataset.singRow===chosen.id));
  }
  singingActive=key;
 }
 const upcoming=list.find(l=>l.start>current&&singingLineIsMine(l)),mine=active.some(singingLineIsMine);
 const text=!list.length?'':mine?tr('正在唱你的词'):upcoming?ui`你的下一句：${fmt(upcoming.start)} · 还有 ${Math.ceil(upcoming.start-current)} 秒`:
  singingRoles.length||singingNotes.size?(list.some(singingLineIsMine)?tr('本曲没有后续自己的词'):tr('还没标出你的唱句。点歌词旁的「我的备注」，勾选「这句我唱」。')):
  singingRoleOptions().length?tr('选角色来高亮自己的词，也可以用「我的备注」逐句标记。'):tr('点歌词旁的「我的备注」，勾选「这句我唱」。');
 if($('#singingContext').textContent!==text)$('#singingContext').textContent=text;
 const state=$('#singingLoopState');if(state){const html=singingRange?ui`<span>循环：${fmt(loop?.start)} → ${fmt(loop?.end)} · 提前 ${singingLead} 秒</span><button data-action="sing-stop-loop">关闭循环</button>`:'';if(state.innerHTML!==html)state.innerHTML=html;}
}
function setSingingFollow(follow){
 singingFollow=follow;
 const button=$('#singingFollow');if(button)button.hidden=follow;
}
function suspendSingingFollow(){if(singing)setSingingFollow(false);}
function seekSingingLine(id,lead=false){
 const l=lyricById(id);if(!l)return;
 singingAnchor=id;setSingingFollow(true);seek(Math.max(0,l.start-(lead?singingLead:0)));updateSingingFocus(true);
}
function navigateSinging(direction){
 const list=sortedSingingLyrics().filter(singingLineIsMine);if(!list.length)return;
 const anchor=list.find(l=>l.id===singingAnchor),at=anchor&&current>=anchor.start-singingLead-.05&&current<=anchor.end?list.indexOf(anchor):list.findIndex(l=>l.start<=current&&l.end>current);
 const next=at>=0?list[at+direction]:direction>0?list.find(l=>l.start>current):list.filter(l=>l.start<current).at(-1);
 if(next)seekSingingLine(next.id,true);else toast(tr(direction>0?'已经是最后一句自己的词。':'已经是第一句自己的词。'));
}
function singingRolesDialog(){
 const options=singingRoleOptions();if(!options.length)return;modal(tr('我负责的角色'),ui`<p>可以选择多个角色；合唱或其他歌手的词会继续显示。</p><div class="sing-role-list">${options.map(r=>`<label class="smallcheck"><input type="checkbox" data-sing-role="${esc(r.id)}" ${singingRoles.includes(r.id)?'checked':''}>${esc(r.name)}</label>`).join('')}</div><button id="applySingingRoles" class="gold">应用</button>`);
 $('#applySingingRoles').onclick=()=>{singingRoles=$$('[data-sing-role]:checked').map(input=>input.dataset.singRole);saveSingingPrefs();closeModal();renderSinging();};
}
function assignSingingLine(id){
 const l=lyricById(id);if(!l)return;pause();const marked=l.speakerIds||[...new Set(lyricSegments(l).flatMap(segment=>segment.roles))];
 modal(tr('指定这句的角色'),ui`<p>${esc(l.text)}</p><p class="muted">这里会保存到演出包，可以撤销。多人分唱时，用 [角色名] 分别标记对应文字。</p><div class="sing-role-list">${show().actors.map(a=>`<label class="smallcheck"><input type="checkbox" data-line-singer="${esc(a.id)}" ${marked.includes(a.id)?'checked':''}>${esc(displayName(a))}</label>`).join('')}</div><div class="dialogactions"><button id="useLyricTags">使用歌词中的标记</button><button id="applyLineSingers" class="gold">保存角色</button></div>`);
 $('#applyLineSingers').onclick=()=>{const ids=$$('[data-line-singer]:checked').map(input=>input.dataset.lineSinger);mutate(()=>{l.speakerIds=ids;},false);closeModal();singingSignature='';renderSinging();};
 $('#useLyricTags').onclick=()=>{mutate(()=>delete l.speakerIds,false);closeModal();singingSignature='';renderSinging();};
}
function startSingingLoop(firstId,lastId){
 const list=sortedSingingLyrics(),from=list.findIndex(l=>l.id===firstId),to=list.findIndex(l=>l.id===lastId);
 if(from<0||to<from){toast(tr('结束句不能早于开始句。'));return false;}
 const chosen=list.slice(from,to+1),start=Math.max(0,chosen[0].start-singingLead),end=Math.min(time(),Math.max(...chosen.map(l=>l.end)));
 if(end<=start){toast(tr('这段歌词没有可播放的时长。'));return false;}
 pause();singleStepEnd=null;singingRange={firstId,lastId};loop={start,end};seekSingingLine(firstId,true);renderSinging();play(true);return true;
}
function singingPassageDialog(){
 const list=sortedSingingLyrics();if(!list.length)return;const first=singingRange?.firstId||currentLyric()?.id||list.find(l=>l.start>current)?.id||list[0].id;
 const options=id=>list.map((l,i)=>`<option value="${esc(l.id)}" ${l.id===id?'selected':''}>${i+1}. ${fmt(l.start)} · ${esc(l.text.slice(0,90))}</option>`).join('');
 modal(tr('循环练习'),ui`<label class="field"><span>开始句</span><select id="singingFrom">${options(first)}</select></label><label class="field"><span>结束句</span><select id="singingTo">${options(singingRange?.lastId||first)}</select></label><label class="field"><span>提前播放</span><select id="singingLead">${[0,2,4].map(v=>`<option value="${v}" ${v===singingLead?'selected':''}>${v} ${tr('秒')}</option>`).join('')}</select></label><button id="startSingingLoop" class="gold">开始循环</button>`);
 $('#startSingingLoop').onclick=()=>{singingLead=+$('#singingLead').value;saveSingingPrefs();if(startSingingLoop($('#singingFrom').value,$('#singingTo').value))closeModal();};
}
const singingPresentation=createViewportPresentation($('#workspace'),'singing-presentation',()=>$('#singingFullscreen'),syncSingingFullscreen);
function syncSingingFullscreen(){
 const button=$('#singingFullscreen');if(!button)return;
 const active=singingPresentation.active(),name=tr(active?'退出全屏（Esc）':'全屏');
 button.setAttribute('aria-pressed',String(active));
 button.setAttribute('aria-label',name);button.title=name;
 if(button.firstElementChild)button.firstElementChild.textContent=active?'×':'⛶';
}

function singingSettingsDialog(){
 modal(tr('练歌设置'),ui`<div class="two practice-settings">
  <label class="field"><span>字号</span><select id="singingSize">${[24,30,38].map(v=>`<option value="${v}" ${v===singingSize?'selected':''}>${v}</option>`).join('')}</select></label>
  <label class="field"><span>速度</span><select id="singingSpeed">${[.5,.75,1,1.25].map(v=>`<option value="${v}" ${v===rate?'selected':''}>${v}×</option>`).join('')}</select></label>
 </div>`);
 $('#singingSize').focus();
}
function singingLineMenu(id){
 const line=lyricById(id);if(!line)return;
 const key=esc(id),hasNote=singingNotes.has(id);
 modal(tr('本句操作'),ui`<p class="practice-line-excerpt">${esc(line.text)}</p>
  <div class="row wrap">
   <button class="gold" data-action="sing-loop:${key}">循环这句</button>
   <button data-action="sing-note:${key}">${hasNote?tr('改备注'):tr('我的备注')}</button>
   ${show().actors.length?ui`<button data-action="sing-assign:${key}">指定角色</button>`:''}
  </div>`);
}
async function singingAction(a){
 if(a==='mode-sing'){enterSinging();return true;}if(!singing)return false;
 if(a==='mode-edit'||a==='mode-rehearse'){exitSinging(a);return true;}
 if(a==='sing-vocal'){
  pause();vocalStop(true);singingVocal=!singingVocal;renderSinging();$('#singVocalMode').focus();return true;
 }
 if(singingVocal&&vocalAction(a))return true;
 if(a==='sing-fullscreen'){await singingPresentation.toggle();return true;}
 if(a==='sing-exit'){exitSinging();return true;}
 if(a==='sing-roles'){singingRolesDialog();return true;}
 if(a==='sing-follow'){setSingingFollow(true);updateSingingFocus(true);return true;}
 if(a==='sing-settings'){singingSettingsDialog();return true;}
 if(a==='sing-previous'||a==='sing-next'){navigateSinging(a==='sing-previous'?-1:1);return true;}
 if(a==='sing-passage'||a==='loop'){singingPassageDialog();return true;}
 if(a==='sing-stop-loop'){loop=null;singingRange=null;updateSingingFocus();return true;}
 if(a.startsWith('sing-jump:')){seekSingingLine(a.slice(10));return true;}
 if(a.startsWith('sing-line-menu:')){singingLineMenu(a.slice('sing-line-menu:'.length));return true;}
 if(a.startsWith('sing-loop:')){const id=a.slice(10);if(startSingingLoop(id,id)&&$('#dialog').open)closeModal();return true;}
 if(a.startsWith('sing-note:')){singingNoteDialog(a.slice(10));return true;}
 if(a.startsWith('sing-assign:')){assignSingingLine(a.slice(12));return true;}
 return false;
}
function handleSingingKey(e,typing,cmd){
 if(e.key==='Escape'&&singingPresentation.active()){e.preventDefault();void singingPresentation.exit();return true;}
 if(typing||cmd)return false;
 if(singingVocal){
  if(e.key==='Escape'){e.preventDefault();vocalStop();singingVocal=false;renderSinging();return true;}
  if(e.code==='Space'&&e.target?.tagName!=='BUTTON'&&e.target?.tagName!=='SUMMARY'){e.preventDefault();vocalPlay();return true;}
  return true;
 }
 if(e.code==='Space'&&e.target?.tagName==='BUTTON')return true;
 if(e.code==='Space'){e.preventDefault();play();return true;}
 if(['ArrowLeft','ArrowRight','[',']'].includes(e.key)){e.preventDefault();navigateSinging(e.key==='ArrowLeft'||e.key==='['?-1:1);return true;}
 if(e.key==='Escape'){e.preventDefault();exitSinging();return true;}
 if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key)){suspendSingingFollow();return true;}
 // Keep blocking shortcuts from changing the hidden workspace while singing.
 if(['Delete','Backspace','n','N','e','E','v','V','F2'].includes(e.key)){e.preventDefault();return true;}return false;
}
document.addEventListener('change',async e=>{
 if(!singing)return;const input=e.target;
 if(input.id==='singingSong')await switchSong(input.value);
 if(input.id==='singingSize'){singingSize=+input.value;saveSingingPrefs();$('#singingList').style.setProperty('--sing-font',singingSize+'px');updateSingingFocus(true);}
 if(input.id==='singingSpeed'){rate=+input.value;audio.playbackRate=rate;audio.preservesPitch=true;$('#speed').value=String(rate);}
});
for(const type of ['wheel','touchmove'])$('#singingList').addEventListener(type,suspendSingingFollow,{passive:true});
$('#singingList').addEventListener('pointerdown',e=>{if(e.clientX>=$('#singingList').getBoundingClientRect().right-18)suspendSingingFollow();});
function updateSongTitleOverflow(){
 for(const text of $$('.song-title-text')){
  const view=text.parentElement,distance=Math.max(0,text.scrollWidth-view.clientWidth);view.classList.toggle('overflows',distance>1);view.style.setProperty('--title-travel',-distance+'px');view.style.setProperty('--title-duration',Math.max(7,distance/24+4)+'s');
 }
}
