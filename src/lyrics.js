/* Lyrics live beside the stage; editing them does not replace the actor inspector. */
let lyricDockVisible=true,lyricEditId=null,lyricDockSong='',lyricRenderSignature='',lyricActiveId=null,lyricFollow=true;
const lyricLiveFields=new WeakSet();
function setLyricsVisible(visible){lyricDockVisible=visible;renderLyricsDock();if(rehearsal)renderRehearsal();}
function lyricById(id){return song()?.lyrics.find(l=>l.id===id);}
function lyricField(l,key,label,type='text'){
 return `<label class="field"><span>${label}</span>${type==='textarea'?`<textarea data-lyric-inline="${esc(l.id)}" data-lyric-field="${key}" aria-label="${label}">${esc(l[key]||'')}</textarea>`:`<input data-lyric-inline="${esc(l.id)}" data-lyric-field="${key}" aria-label="${label}" type="number" min="0" step="0.1" value="${l[key]}" ${key==='start'?tr('title="移动开始时间时保留原时长"'):''}>`}</label>`;
}
function renderLyricsDock(force=false){
 if(!song())return;const identity=showId+'/'+songId;if(identity!==lyricDockSong){lyricDockSong=identity;lyricEditId=null;lyricRenderSignature='';lyricActiveId=null;}
 if(lyricEditId&&!lyricById(lyricEditId))lyricEditId=null;
 $('#lyricsDock').classList.toggle('hidden',!lyricDockVisible);$('#stageAndLyrics').classList.toggle('lyrics-hidden',!lyricDockVisible);$('#lyricsToggle').classList.toggle('selected',lyricDockVisible);$('#lyricsToggle').setAttribute('aria-pressed',String(lyricDockVisible));$('#lyricsCount').textContent=song().lyrics.length?ui`${song().lyrics.length} 句`:'';
 $('#lyricFollowButton').classList.toggle('selected',lyricFollow);$('#lyricFollowButton').setAttribute('aria-pressed',String(lyricFollow));
 const signature=JSON.stringify(song().lyrics)+'|'+lyricEditId+'|'+rehearsal+'|'+StageI18n.language,focused=document.activeElement?.closest?.('[data-lyric-inline]');
 if(force||signature!==lyricRenderSignature){
  if(!force&&focused&&focused.dataset.lyricInline===lyricEditId){lyricRenderSignature=signature;updateLyricsFocus();return;}
  const list=[...song().lyrics].sort((a,b)=>a.start-b.start||a.end-b.end);
  $('#lyricsList').innerHTML=list.length?list.map((l,i)=>{
   const edit=lyricEditId===l.id;
   return ui`<article class="dock-lyric ${edit?'editing':''}" data-lyric-row="${esc(l.id)}"><div class="dock-lyric-heading"><button data-action="lyrics-jump:${esc(l.id)}" class="lyric-time" aria-label="定位第 ${i+1} 句歌词，${fmt(l.start)}">${fmt(l.start)} → ${fmt(l.end)}</button>${!rehearsal?ui`<button data-action="lyrics-edit:${esc(l.id)}" class="lyric-edit-button" aria-label="编辑第 ${i+1} 句歌词">${edit?tr('收起'):tr('编辑')}</button>`:''}</div>${edit?lyricField(l,'text',tr('歌词内容'),'textarea')+ui`<div class="two">${lyricField(l,'start',tr('开始秒数'),'number')}${lyricField(l,'end',tr('结束秒数'),'number')}</div><p class="lyric-edit-tip">改开始时间会保留原时长；结束时间可单独调。</p><details><summary>这句的备注</summary>${lyricField(l,'notes',tr('歌词备注'),'textarea')}</details><div class="lyric-edit-actions"><button data-action="lyrics-edit:${esc(l.id)}">完成</button><button class="danger" data-action="lyrics-delete:${esc(l.id)}">删除这句</button></div>`:`<button class="lyric-line" data-action="lyrics-jump:${esc(l.id)}">${esc(l.text||tr('（空白歌词）'))}</button>${l.notes?`<p class="dock-lyric-note">${esc(l.notes)}</p>`:''}`}</article>`;
  }).join(''):ui`<div class="lyrics-empty"><p>歌词和走台可以一起看、一起改。</p><button data-action="lyrics">导入歌词</button><button data-action="add-lyric">在当前时间写一句</button></div>`;
  lyricRenderSignature=signature;
 }
 updateLyricsFocus();
}
function updateLyricsFocus(forceFollow=false){
 if(!song())return;$('#lyricClock').textContent=fmt(current);const active=currentLyric(),id=active?.id||null;
 $('#lyricCurrentLabel').textContent=active?tr('当前歌词'):song().lyrics.length?tr('间奏 · 当前没有歌词'):tr('尚未导入歌词');
 for(const row of $$('[data-lyric-row]')){const on=row.dataset.lyricRow===id;row.classList.toggle('active',on);row.setAttribute('aria-current',on?'true':'false');}
 if((id!==lyricActiveId||forceFollow)&&id&&lyricDockVisible&&lyricFollow&&!lyricEditId){const row=$$('[data-lyric-row]').find(row=>row.dataset.lyricRow===id);row?.scrollIntoView?.({block:'nearest',behavior:'smooth'});}lyricActiveId=id;
}
function seekToLyric(id){
 const l=lyricById(id);if(!l)return;pause();singleStepEnd=null;current=l.start;const event=eventAtCursor();selectedCue=event?.cue.id||null;tool='select';stagePhase='live';
 if(!rehearsal)inspect=selected.length?{type:selected.length>1?'group':'entity',id:selected[0]}:{type:event?'cue':'song',id:event?.cue.id||songId};current=l.start;renderAll();seek(l.start);
}
function refreshLyricViews(){renderBottom();renderStage();if(rehearsal)renderRehearsal();updateTransport();}
function addDockLyric(){
 if(!canEdit())return;pause();const start=timeRound(current),next=song().lyrics.filter(l=>l.start>start).sort((a,b)=>a.start-b.start)[0],l={id:C.id('lyric'),start,end:Math.min(start+4,next?.start??start+4),text:'',notes:''};
 mutate(()=>song().lyrics.push(l),false);lyricEditId=l.id;lyricDockVisible=true;renderLyricsDock(true);refreshLyricViews();$('#lyricsList [data-lyric-field="text"]')?.focus();return l;
}
function deleteDockLyric(id){
 if(!canEdit()||!lyricById(id))return;mutate(()=>song().lyrics=song().lyrics.filter(l=>l.id!==id),false);lyricEditId=null;if(inspect.type==='lyric'&&inspect.id===id)inspect={type:selected.length?'entity':'song',id:selected[0]||songId};renderLyricsDock(true);refreshLyricViews();renderInspector();toast(tr('已删除这句歌词；走台保持原样，可撤销。'));
}
async function lyricsAction(a){
 if(a==='lyrics-toggle'){setLyricsVisible(!lyricDockVisible);return true;}
 if(a==='lyrics-show'){setLyricsVisible(true);return true;}
 if(a==='lyrics-follow'){lyricFollow=!lyricFollow;renderLyricsDock();updateLyricsFocus(true);return true;}
 if(a==='add-lyric'){addDockLyric();return true;}
 if(a.startsWith('lyrics-jump:')){seekToLyric(a.slice(12));return true;}
 if(a.startsWith('lyrics-edit:')){if(canEdit()){const id=a.slice(12);if(lyricById(id)){lyricDockVisible=true;lyricEditId=lyricEditId===id?null:id;renderLyricsDock(true);}}return true;}
 if(a.startsWith('lyrics-delete:')){deleteDockLyric(a.slice(14));return true;}
 return false;
}
document.addEventListener('input',e=>{
 const input=e.target,key=input.dataset?.lyricField;if(!['text','notes'].includes(key))return;const l=lyricById(input.dataset.lyricInline);if(!l||rehearsal)return;
 if(!lyricLiveFields.has(input)){snapshot();lyricLiveFields.add(input);}l[key]=input.value;changed();refreshLyricViews();
});
document.addEventListener('change',e=>{
 const input=e.target,key=input.dataset?.lyricField;if(!key)return;const l=lyricById(input.dataset.lyricInline);if(!l||rehearsal)return;
 if(['text','notes'].includes(key)){lyricLiveFields.delete(input);renderLyricsDock();return;}
 if(!['start','end'].includes(key))return;const value=Number(input.value);
 if(input.value===''||!C.finite(value)||value<0||key==='end'&&value<l.start){input.value=l[key];toast(tr('请输入有效秒数，结束时间不能早于开始时间。'));return;}
 mutate(()=>{if(key==='start'){const duration=l.end-l.start;l.start=value;l.end=Math.round((value+duration)*1000)/1000;}else l.end=value;},false);const row=input.closest?.('[data-lyric-row]'),endInput=row?.querySelector('[data-lyric-field="end"]'),label=row?.querySelector('.lyric-time');if(endInput)endInput.value=l.end;if(label)label.textContent=fmt(l.start)+' → '+fmt(l.end);refreshLyricViews();renderLyricsDock();
});
$('#lyricsList').addEventListener('wheel',()=>{lyricFollow=false;$('#lyricFollowButton').classList.remove('selected');$('#lyricFollowButton').setAttribute('aria-pressed','false');},{passive:true});
