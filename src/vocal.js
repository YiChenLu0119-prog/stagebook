/* Voice parts belong to the song. The preview cursor and solo selection are session state. */
let vocalClipId='',vocalPartId='',vocalAt=0,vocalContext,vocalPlayback,vocalGeneration=0,vocalResume=false,vocalQuery='',vocalCueKey='';

function vocalClip(){
 if(vocalRun)return vocalRun.clip;
 const clips=song()?.vocalPractice?.clips||[];
 return clips.find(clip=>clip.id===vocalClipId)||clips[0];
}
function vocalParts(clip){
 return vocalPartId?clip.parts.filter(part=>part.id===vocalPartId):clip.parts;
}
function vocalDuration(clip){
 if(clip.rangeEnd!==undefined)return clip.rangeEnd;
 let end=0;
 for(const part of clip.parts)for(const note of part.notes)end=Math.max(end,note.start+note.duration);
 return Math.ceil(end*100)/100;
}
function vocalPosition(){
 const slider=$('#vocalProgress'), clock=$('#vocalClock'), button=$('#vocalPlay');
 if(slider)slider.value=String(vocalAt);
 if(clock)clock.textContent=fmt(vocalAt)+' / '+fmt(Number(slider.max));
 if(button)button.textContent=tr(vocalPlayback?'暂停试听':'开始试听');
 const clip=vocalClip();
 const precedingBar=vocalCurrentBar;
 const precedingCue=vocalCueKey;
 renderVocalScore(clip);
 updateVocalCue(clip);
 if(vocalRun&&vocalPlayback&&(vocalCurrentBar!==precedingBar||vocalCueKey!==precedingCue))revealVocalBar(true);
}
function vocalStop(reset=false){
 vocalGeneration++;
 if(vocalPlayback){
  cancelAnimationFrame(vocalPlayback.frame);
  for(const oscillator of vocalPlayback.oscillators){try{oscillator.stop();}catch{}}
  vocalPlayback=null;
 }
 if(reset){vocalAt=0;vocalClipId='';vocalPartId='';vocalResume=false;vocalQuery='';vocalRun=null;}
 if(singingVocal)vocalPosition();
}
async function vocalPlay(){
 const clip=vocalClip();
 if(!clip)return;
 if(vocalPlayback){vocalStop();return;}
 const duration=vocalDuration(clip);
 if(vocalAt>=duration)vocalAt=0;
 const entry=++vocalGeneration;
 try{
  vocalContext ||= new AudioContext();
  await vocalContext.resume();
  if(entry!==vocalGeneration)return;
  const parts=vocalParts(clip);
  const notes=new Map();
  for(const part of parts)for(const note of part.notes)
   if(note.start+note.duration>vocalAt)notes.set([note.start,note.duration,note.midi].join(','),note);
  if(!notes.size)return;
  const from=vocalAt, origin=vocalContext.currentTime+.07;
  const state={frame:0,oscillators:[]};
  vocalPlayback=state;
  for(const note of notes.values()){
   const start=Math.max(note.start,from);
   const at=origin+start-from, length=note.start+note.duration-start;
   const oscillator=vocalContext.createOscillator(),gain=vocalContext.createGain();
   oscillator.type='triangle';
   oscillator.frequency.value=440*2**((note.midi-69)/12);
   oscillator.connect(gain).connect(vocalContext.destination);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   gain.gain.setValueAtTime(0,at);
   gain.gain.linearRampToValueAtTime(parts.length===1?.13:.057,at+Math.min(.015,length*.25));
   gain.gain.linearRampToValueAtTime(0,at+length);
   state.oscillators.push(oscillator);
   oscillator.start(at);oscillator.stop(at+length+.01);
  }
  const tick=()=>{
   if(vocalPlayback!==state)return;
   vocalAt=Math.min(duration,from+Math.max(0,vocalContext.currentTime-origin));
   vocalPosition();
   if(vocalAt>=duration)vocalStop();else state.frame=requestAnimationFrame(tick);
  };
  tick();
 }catch{vocalStop();toast(tr('无法播放和声试听。'));}
}
function vocalPitch(midi){
 return ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][midi%12]+(Math.floor(midi/12)-1);
}
function vocalSearchText(value){
 return value.toLowerCase().replace(/[’']/g,'').normalize('NFKC').replace(/大合唱|合唱團|合唱团/g,'合唱');
}
function vocalRoleLabel(role){
 const company=/^Company · (\d+)$/.exec(role);
 return company?tr('合唱声部 {0}').replace('{0}',company[1]):role;
}
function vocalCurrentSection(clip){
 const bar=clip.bars?.findLast(row=>row.start<=vocalAt+.0005)?.number;
 return {bar,entry:clip.sections?.findLast(section=>section.bar<=bar)};
}
function updateVocalCue(clip){
 const label=document.querySelector('#vocalActiveSection');
 if(!clip||!label)return;
 const {bar,entry}=vocalCurrentSection(clip);
 const marker=clip.markers?.findLast(item=>item.start<=vocalAt+.0005);
 const key=[clip.id,entry?.bar,bar,marker?.start].join(':');
 if(key===vocalCueKey)return;
 vocalCueKey=key;
 label.textContent=[marker?.title||entry?.title,bar?vocalBarName(bar):''].filter(Boolean).join(' · ');
 label.hidden=!label.textContent;
 const list=document.querySelector('#vocalPassageList');
 const rows=list?.querySelectorAll('.vocal-passage')||[];
 const action='vocal-clip:'+(marker?.clipId||clip.id)+':';
 const current=[...rows].find(row=>row.dataset.action===action+(entry?.bar||0))||
  [...rows].find(row=>row.dataset.action===action+bar);
 for(const row of rows)row.setAttribute('aria-current',String(row===current));
}
function vocalPassageList(clips){
 const measureQuery=/^(?:(?:第|bar)\s*)?(\d{1,3})\s*(?:小节)?$/i.exec(vocalQuery.trim());
 const barNumber=Number(measureQuery?.[1]);
 const terms=measureQuery?[]:vocalSearchText(vocalQuery.trim()).split(/\s+/).filter(Boolean);
 const entries=clips.flatMap(clip=>{
  const sections=(clip.sections||[]).map(entry=>({...entry,clip,target:entry.bar}));
  if(barNumber){
   if(!clip.bars?.some(bar=>bar.number===barNumber))return [];
   return [sections.find(entry=>entry.target===barNumber)||{clip,title:clip.title,target:barNumber}];
  }
  const lines=clip.timebase==='recording'?song().lyrics.filter(line=>line.start<clip.offset+vocalDuration(clip)&&line.end>clip.offset):[];
  return [{clip,title:clip.title,target:0,lines},...sections];
 });
 return entries.filter(entry=>{
  const {clip,title,target,lines=[]}=entry;
  const text=vocalSearchText([title,target?'':clip.measure,target?'':clip.parts.map(part=>vocalRoleLabel(part.role)).join(' '),
   target?vocalBarName(target):'',lines.map(line=>line.text).join(' ')].join(' '));
  return terms.every(term=>text.includes(term));
 }).sort((a,b)=>terms.length?Boolean(b.target)-Boolean(a.target):0).map(({clip,title,target,lines=[]})=>{
  const snippet=(terms.length?lines.find(line=>terms.some(term=>vocalSearchText(line.text).includes(term))):null)?.text.replace(/\[[^\]]+\]/g,'').trim().split(/\s+/).slice(0,7).join(' ');
  return `<button class="vocal-passage ${target?'vocal-subpassage':''}" data-action="vocal-clip:${esc(clip.id)}:${target}" aria-current="false">
    <strong>${esc(title)}</strong><small>${esc(target?vocalBarName(target):clip.measure)}</small>${snippet?`<small>${esc(snippet)}</small>`:''}</button>`;
 }).join('')||`<p class="muted">${tr('没有找到唱段')}</p>`;
}
function renderVocalPractice(){
 $('#singingList').classList.add('hidden');
 $('#singingContext').classList.add('hidden');
 const panel=$('#vocalPractice'),clips=song()?.vocalPractice?.clips||[];
 const clip=vocalClip();
 if(!clip)return;
 panel.classList.remove('hidden');
 if(!vocalRun)vocalClipId=clip.id;
 if(!clip.parts.some(part=>part.id===vocalPartId))vocalPartId='';
 const parts=vocalParts(clip),end=vocalDuration(clip);
 const hasNotes=parts.some(part=>part.notes.length);
 const listTop=$('#vocalPassageList')?.scrollTop||0;
 vocalAt=Math.min(vocalAt,end);
 vocalScoreKey='';vocalCueKey='';
 panel.innerHTML=ui`<div class="vocal-workspace">
 <aside class="vocal-index">
  <label><span>找唱段</span><input id="vocalSearch" type="search" placeholder="搜唱段、角色或小节" value="${esc(vocalQuery)}"></label>
  <div id="vocalPassageList">${vocalPassageList(clips)}</div>
 </aside>
 <div class="vocal-main">
  <div class="vocal-controls">
   <div><h2>${esc(clip.title)}</h2>
    ${vocalRun?`<p class="vocal-run-label">${esc(clip.firstTitle)} → ${esc(clip.lastTitle)}</p>`:''}
    <span id="vocalActiveSection" class="vocal-active-section" hidden></span>
   </div>
   <label>声部<select id="vocalPart"><option value="">合听</option>${clip.parts.map(part=>`<option value="${esc(part.id)}" ${part.id===vocalPartId?'selected':''}>${esc(vocalRoleLabel(part.role))}</option>`).join('')}</select></label>
   <div class="vocal-player">
    <button id="vocalPlay" data-action="vocal-play" class="gold" ${hasNotes?'':'disabled'}>开始试听</button>
    <label class="vocal-scrub"><span>试听进度</span><input id="vocalProgress" aria-label="试听进度" type="range" min="0" max="${end}" step=".01" value="${vocalAt}" ${hasNotes?'':'disabled'}></label>
    <output id="vocalClock" for="vocalProgress"></output>
    ${hasNotes?ui`<button id="vocalRunButton" data-action="vocal-run">${tr(vocalRun?'修改连练范围':'连起来练')}</button>`:''}
    ${vocalRun?ui`<button data-action="vocal-run-exit">退出连练</button>`:''}
   </div>
  </div>
  ${hasNotes?'<div id="vocalScore"></div>':ui`<p class="vocal-empty">这一段没有可试听的音高。可返回歌词页跟原录音练习。</p>`}
  ${clip.memo?`<details class="vocal-reference"><summary>${tr('片段说明')}</summary><p>${esc([clip.measure,clip.memo].filter(Boolean).join(' · '))}</p>${clip.sourceURL?`<a href="${esc(clip.sourceURL)}" target="_blank" rel="noopener">${tr('查看原谱')}</a>`:''}</details>`:''}
 </div></div>`;
 $('#vocalPassageList').scrollTop=listTop;
 $('#vocalSearch').oninput=event=>{
  vocalQuery=event.target.value;
  $('#vocalPassageList').innerHTML=vocalPassageList(clips);
  vocalCueKey='';updateVocalCue(clip);
 };
 $('#vocalPart').onchange=event=>{
  vocalStop();
  vocalPartId=event.target.value;
  const firstNote=vocalPartId&&clip.parts.find(part=>part.id===vocalPartId)?.notes[0];
  if(firstNote&&firstNote.start>vocalAt)vocalAt=clip.bars?.find(bar=>bar.number===firstNote.bar)?.start??firstNote.start;
  renderVocalPractice();
  $('#vocalPart').focus({preventScroll:true});
  revealVocalBar();
 };
 const slider=$('#vocalProgress');
 slider.oninput=()=>{
  const next=Number(slider.value);
  if(vocalPlayback){vocalResume=true;vocalStop();}
  vocalAt=next;
  vocalPosition();
 };
 slider.onchange=()=>{
  revealVocalBar();
  if(vocalResume){vocalResume=false;if(vocalAt<end)vocalPlay();}
 };
 vocalPosition();
}
function seekVocalBar(bar){
 if(!bar)return;
 const running=Boolean(vocalPlayback);
 vocalStop();
 vocalAt=bar.start;
 vocalPosition();
 revealVocalBar();
 if(running)vocalPlay();
}
function editVocalNote(partId,noteId){
 const currentRun=vocalRun,source=currentRun?.notes.get(noteId);
 const clip=source?.clip||vocalClip(),voice=source?.voice||clip?.parts.find(part=>part.id===partId);
 const note=source?.note||voice?.notes.find(item=>item.id===noteId);
 if(!note)return;
 vocalStop();
 modal(tr('编辑音符'),ui`<label class="field"><span>音高（MIDI）</span><input id="vocalMidi" type="number" min="0" max="127" value="${note.midi}"></label>
 ${note.bar?'<p>'+vocalBarName(note.bar)+'</p>':''}
 ${note.beats===undefined?'':ui`<label class="field"><span>音符时值</span><select id="vocalBeats">${vocalWrittenValues.map(([value,label])=>`<option value="${value}" ${value===note.beats?'selected':''}>${tr(label)}</option>`).join('')}</select></label>`}
 <label class="field"><span>歌词音节</span><input id="vocalSyllable" maxlength="80" value="${esc(note.syllable)}"></label>
 <div class="dialogactions"><button id="saveVocalNote" class="gold">保存</button></div>`);
 $('#saveVocalNote').onclick=()=>{
  const next={...note,midi:$('#vocalMidi').valueAsNumber,syllable:$('#vocalSyllable').value.trim()};
  if(note.beats!==undefined){
   next.beats=Number($('#vocalBeats').value);
   next.start=note.start;
   next.duration=Math.round(note.duration*next.beats/note.beats*1000)/1000;
  }
  if(!C.validVocalNote(next)){toast(tr('音符的音高或时间无效。'));return;}
  if(vocalRun!==currentRun||!song()?.vocalPractice?.clips.includes(clip))return;
  mutate(()=>{Object.assign(note,next);voice.notes.sort((a,b)=>a.start-b.start);},false);
  if(currentRun)vocalRun=buildVocalRun(currentRun.units,currentRun.previous);
  closeModal();renderVocalPractice();
 };
}
function vocalAction(action){
 if(action==='vocal-play'){vocalPlay();return true;}
 if(action==='vocal-run'){vocalRunDialog();return true;}
 if(action==='vocal-run-exit'){leaveVocalRun();return true;}
 if(action.startsWith('vocal-clip:')){
  const [,id,number]=action.split(':');
  vocalStop();
  vocalRun=null;
  if(vocalClipId!==id)vocalPartId='';
  vocalClipId=id;
  vocalAt=vocalClip()?.bars?.find(bar=>bar.number===Number(number))?.start||0;
  renderVocalPractice();
  document.querySelector(`[data-action="${action}"]`)?.focus({preventScroll:true});
  if(Number(number))revealVocalBar();
  else if(matchMedia('(max-width:680px)').matches)document.querySelector('.vocal-main')?.scrollIntoView({block:'start'});
  return true;
 }
 if(action.startsWith('vocal-bar:')){seekVocalBar(vocalClip()?.bars?.find(bar=>bar.number===Number(action.slice(10))));return true;}
 if(action.startsWith('vocal-edit:')){editVocalNote(...action.split(':').slice(1));return true;}
 return false;
}
