/* Group practice combines the selected excerpts on a temporary playback clock.
   Original note IDs and the source clip stay available to the editor. */
let vocalRun=null;
const vocalRound=value=>Math.round(value*1000)/1000;

function vocalClipSpan(clip){
 const bars=clip.bars||[];
 if(bars.length<2)return vocalDuration(clip);
 const last=bars[bars.length-1].start;
 const typical=(last-bars[0].start)/(bars.length-1);
 return Math.max(vocalDuration(clip),last+Math.min(typical,4));
}
function vocalRangeUnits(clips,clock){
 const candidates=clips.filter(clip=>clip.timebase===clock&&clip.parts.some(part=>part.notes.length));
 if(clock==='recording')candidates.sort((a,b)=>a.offset-b.offset);
 return candidates.flatMap(clip=>{
  const named=clip.sections||[];
  const cuts=named.map(section=>({title:section.title,start:clip.bars.find(bar=>bar.number===section.bar)?.start}))
   .filter(section=>section.start!==undefined).sort((a,b)=>a.start-b.start);
  if(!cuts.length||cuts[0].start>0)cuts.unshift({title:clip.title,start:0});
  const duration=vocalDuration(clip);
  return cuts.map((section,i)=>({...section,clip,end:cuts[i+1]?.start??duration}))
   .filter(unit=>unit.end>unit.start);
 });
}
function buildVocalRun(units,previous){
 const first=units[0],last=units.at(-1),clock=first.clip.timebase;
 const firstAt=(first.clip.offset??0)+first.start;
 const notes=new Map(),parts=new Map(),bars=new Map(),markers=[];
 const placements=new Map();
 let next=-first.start,end=0;
 for(const [index,unit] of units.entries()){
  if(!placements.has(unit.clip)){
   const from=clock==='recording'?unit.clip.offset-firstAt:next;
   placements.set(unit.clip,from);
   next=from+vocalClipSpan(unit.clip);
  }
  const offset=placements.get(unit.clip);
  const start=vocalRound(offset+unit.start);
  end=Math.max(end,vocalRound(offset+unit.end));
  markers.push({title:unit.title,start,clipId:unit.clip.id});
  for(const bar of unit.clip.bars||[]){
   if(bar.start>=unit.start&&bar.start<unit.end&&!bars.has(bar.number))
    bars.set(bar.number,{number:bar.number,start:vocalRound(offset+bar.start)});
  }
  // Keep overlapping harmony tracks separate when two parts have the same name.
  const occurrences=new Map();
  for(const voice of unit.clip.parts){
   const number=(occurrences.get(voice.role)||0)+1;
   occurrences.set(voice.role,number);
   const roleKey=JSON.stringify([voice.role,number]);
   for(const note of voice.notes){
    const from=Math.max(note.start,unit.start),to=Math.min(note.start+note.duration,unit.end);
    if(to-from<.015)continue;
    let part=parts.get(roleKey);
    if(!part){part={id:'range-part-'+(parts.size+1),role:voice.role,notes:[]};parts.set(roleKey,part);}
    const id='range-'+index+'-'+notes.size;
    part.notes.push({...note,id,start:vocalRound(offset+from),duration:vocalRound(to-from)});
    notes.set(id,{clip:unit.clip,voice,note});
   }
  }
 }
 for(const part of parts.values())part.notes.sort((a,b)=>a.start-b.start);
 return {units,previous,notes,clip:{
  id:'group-practice',title:tr('全团连练'),
  timebase:clock,offset:clock==='recording'?firstAt:null,
  parts:[...parts.values()],bars:[...bars.values()].sort((a,b)=>a.start-b.start),
  markers,rangeEnd:end,firstTitle:first.title,lastTitle:last.title
 }};
}
function vocalRunDialog(){
 const all=song()?.vocalPractice?.clips||[];
 const active=vocalRun?.previous.clip||vocalClip();
 if(!active)return;
 const units=vocalRangeUnits(all,active.timebase);
 if(!units.length)return;
 const current=vocalRun?units.findIndex(unit=>unit.clip===vocalRun.units[0].clip&&unit.start===vocalRun.units[0].start):
  units.findLastIndex(unit=>unit.clip===active&&unit.start<=vocalAt);
 const from=Math.max(0,current);
 const oldEnd=vocalRun?.units.at(-1);
 const through=oldEnd?units.findIndex(unit=>unit.clip===oldEnd.clip&&unit.start===oldEnd.start):from+1;
 const choices=(which,first)=>units.map((unit,index)=>index<first?'':`<option value="${index}" ${index===which?'selected':''}>${esc(unit.title)}</option>`).join('');
 modal(tr('连起来练'),ui`<label class="field"><span>从哪段开始</span><select id="vocalRunFrom">${choices(from,0)}</select></label>
  <label class="field"><span>唱到哪段结束</span><select id="vocalRunThrough">${choices(Math.min(Math.max(from,through),units.length-1),from)}</select></label>
  <p class="muted">${tr(active.timebase==='recording'?'按录音时间连接现有声部，唱段之间的空隙会保留。':'按谱面顺序连接已录入的唱段。')}</p>
  <div class="dialogactions"><button id="vocalRunApply" class="gold">使用这段范围</button></div>`);
 $('#vocalRunFrom').onchange=()=>{
  const start=Number($('#vocalRunFrom').value),end=Number($('#vocalRunThrough').value);
  $('#vocalRunThrough').innerHTML=choices(Math.max(start,end),start);
 };
 $('#vocalRunApply').onclick=()=>{
  const start=Number($('#vocalRunFrom').value),end=Number($('#vocalRunThrough').value);
  const previous=vocalRun?.previous||{clip:active,at:vocalAt,partId:vocalPartId};
  const run=buildVocalRun(units.slice(start,end+1),previous);
  if(!run.clip.parts.length)return;
  vocalStop();
  vocalRun=run;vocalPartId='';vocalAt=0;vocalResume=false;
  closeModal();
  renderVocalPractice();
  $('#vocalPlay').focus({preventScroll:true});
 };
}
function leaveVocalRun(){
 if(!vocalRun)return;
 vocalStop();
 const {clip,at,partId}=vocalRun.previous;
 vocalClipId=clip.id;
 vocalRun=null;vocalPartId=partId;vocalAt=at;vocalResume=false;
 renderVocalPractice();
 $('#vocalRunButton').focus({preventScroll:true});
}
