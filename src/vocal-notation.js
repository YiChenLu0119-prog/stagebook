/* The notation clock uses the score’s bar and written value. Playback seconds
   are used only to seek and highlight the corresponding note. */
const vocalWrittenValues=[
 [.125,'三十二分音符'],[.25,'十六分音符'],[.375,'附点十六分音符'],
 [.5,'八分音符'],[.75,'附点八分音符'],[1,'四分音符'],[1.5,'附点四分音符'],
 [2,'二分音符'],[3,'附点二分音符'],[4,'全音符'],[6,'附点全音符']
];
const vocalWrittenName=beats=>tr(vocalWrittenValues.find(([value])=>value===beats)?.[1]||'时值待核');
const vocalBarName=number=>tr('第 {0} 小节').replace('{0}',String(number));
let vocalScoreKey='',vocalCurrentBar=null,vocalHighlighted=[];

function restoreVocalNotation(draft,published){
 const indexed=rows=>new Map(rows.map(row=>[row.id,row]));
 const shows=indexed(published.shows);
 for(const show of draft.shows){
  const original=shows.get(show.id);
  if(!original)continue;
  const songs=indexed(original.songs);
  for(const song of show.songs){
   const notation=songs.get(song.id)?.vocalPractice;
   if(!notation)continue;
   if(!song.vocalPractice){song.vocalPractice=C.clone(notation);continue;}
   const clips=indexed(notation.clips);
   for(const clip of song.vocalPractice.clips){
    const source=clips.get(clip.id);
    if(!source||clip.bars||!source.bars)continue;
    clip.bars=C.clone(source.bars);
    if(!clip.sections&&source.sections)clip.sections=C.clone(source.sections);
    const parts=indexed(source.parts);
    for(const part of clip.parts){
     const notes=indexed(parts.get(part.id)?.notes||[]);
     for(const note of part.notes){
      const old=notes.get(note.id);
      if(!old||note.start!==old.start)continue;
      if(old.bar!==undefined)note.bar??=old.bar;
      if(old.beats!==undefined&&note.duration===old.duration)note.beats??=old.beats;
     }
    }
   }
  }
 }
 return draft;
}

function vocalGlyph(note, clefBottom){
 const tone=note.midi%12;
 const degree=[0,0,1,2,2,3,3,4,5,5,6,6][tone];
 const staffStep=(Math.floor(note.midi/12)-1)*7+degree-clefBottom;
 const y=60-staffStep*4;
 const isFlat=[3,8,10].includes(tone),isSharp=[1,6].includes(tone);
 const dotted=[.375,.75,1.5,3,6].includes(note.beats);
 const base=dotted?note.beats/1.5:note.beats;
 const flags=base<1?Math.round(-Math.log2(base)):0;
 let ledger='';
 for(let step=10;step<=staffStep;step+=2)ledger+=`<path d="M8 ${60-step*4}h18"/>`;
 for(let step=-2;step>=staffStep;step-=2)ledger+=`<path d="M8 ${60-step*4}h18"/>`;
 const stemDown=staffStep>=4;
 const x=stemDown?12:21, dir=stemDown?1:-1, tip=y+dir*24;
 let stems=base&&base<4?`<path d="M${x} ${y}V${tip}"/>`:'';
 for(let flag=0;flag<flags;flag++){
  const top=tip-dir*4*flag;
  stems+=`<path d="M${x} ${top}q6 ${-dir*2} 8 ${-dir*12}"/>`;
 }
 return `<svg viewBox="0 -26 36 154" preserveAspectRatio="none" aria-hidden="true">${ledger}${stems}
 <ellipse class="${base>=2?'hollow':''}" rx="5.2" ry="3.2" cx="17" cy="${y}" transform="rotate(-17 17 ${y})"/>
 ${dotted?`<circle cx="26" cy="${y-2}" r="1.4"/>`:''}
 ${isFlat||isSharp?`<text x="1" y="${y+4}">${isFlat?'♭':'♯'}</text>`:''}</svg>`;
}
function vocalNoteMarkup(part,note,treble){
 const label=[vocalPitch(note.midi),vocalWrittenName(note.beats),note.syllable].filter(Boolean).join(' · ');
 return `<button class="vocal-note" data-action="vocal-edit:${esc(part.id)}:${esc(note.id)}" data-start="${note.start}" data-end="${note.start+note.duration}" title="${esc(label)}" aria-label="${esc(label)}">
 ${vocalGlyph(note,treble?30:18)}<span>${vocalPitch(note.midi)}</span>${note.beats===undefined?'<small aria-hidden="true">?</small>':''}${note.syllable?`<small>${esc(note.syllable)}</small>`:''}</button>`;
}
function vocalStaff(part,items,group,treble,showRole){
 const clef=`<span class="vocal-clef" aria-label="${tr(treble?'高音谱号':'低音谱号')}">${treble?'𝄞':'𝄢'}</span>`;
 return `<div class="vocal-staff">${showRole?`<h4>${esc(vocalRoleLabel(part.role))}</h4>`:''}<div class="vocal-staff-line">${clef}
  ${group.map(({number,weight},index)=>{
   const notes=items.get(number)||[];
   const target=number?`data-bar="${number}"`:'';
   const numberLink=number?`<button class="vocal-bar-number" data-action="vocal-bar:${number}" aria-label="${vocalBarName(number)}">${number}</button>`:'';
   return `<div class="vocal-staff-measure ${index===0?'system-start':''}" ${target} style="--bar-weight:${weight}">${numberLink}
    <div class="vocal-notes">${notes.map(note=>vocalNoteMarkup(part,note,treble)).join('')}</div></div>`;
  }).join('')}</div></div>`;
}
function vocalScoreRows(parts,bars,width){
 const byPart=parts.map(part=>{
  const byBar=new Map();
  for(const note of part.notes){
   const number=note.bar||0;
   if(!byBar.has(number))byBar.set(number,[]);
   byBar.get(number).push(note);
  }
  const treble=part.notes.reduce((sum,note)=>sum+note.midi,0)/part.notes.length>=56;
  return {part,byBar,treble};
 });
 const rows=[];
 let row=[],used=0;
 for(const bar of bars){
  const count=Math.max(0,...byPart.map(({byBar})=>byBar.get(bar.number)?.length||0));
  const weight=Math.max(42,count*30+8);
  if(row.length&&used+weight>width-32){rows.push(row);row=[];used=0;}
  row.push({number:bar.number,weight});
  used+=weight;
 }
 if(row.length)rows.push(row);
 const systems=rows.map(group=>{
  const assigned=byPart.filter(({byBar})=>group.some(bar=>byBar.has(bar.number)));
  if(!assigned.length)return '';
  return `<section class="vocal-system">${assigned.map(({part,byBar,treble})=>vocalStaff(part,byBar,group,treble,parts.length>1)).join('')}</section>`;
 }).join('');
 const numbered=new Set(bars.map(bar=>bar.number));
 const unknown=byPart.map(({part,treble})=>{
  const notes=part.notes.filter(note=>!numbered.has(note.bar));
  if(!notes.length)return '';
  const perRow=Math.max(4,Math.floor((width-32)/30));
  const group=[{number:0,weight:100}];
  let body='';
  for(let i=0;i<notes.length;i+=perRow)body+=vocalStaff(part,new Map([[0,notes.slice(i,i+perRow)]]),group,treble,i===0&&parts.length>1);
  return `<section class="vocal-system">${body}</section>`;
 }).join('');
 return {systems,unknown};
}
function renderVocalScore(clip){
 const root=document.querySelector('#vocalScore');
 if(!root||!clip)return;
 const bars=clip.bars||[];
 const width=root.clientWidth;
 const key=[clip.id,vocalPartId,width].join(':');
 if(key!==vocalScoreKey){
  vocalScoreKey=key;
  vocalCurrentBar=null;
  vocalHighlighted=[];
  const priorOpen=root.querySelector('.vocal-unplaced')?.open;
  const parts=vocalParts(clip).filter(part=>part.notes.length);
  const {systems,unknown}=vocalScoreRows(parts,bars,width);
  root.innerHTML=ui`<div class="vocal-score-nav"><h3>五线谱</h3></div>
   ${!bars.length?ui`<p class="muted">这段有音高记录，小节及时值待核。</p>`:''}
   ${systems}
   ${!bars.length?unknown:unknown?ui`<details class="vocal-unplaced" ${priorOpen?'open':''}><summary>未定位小节的音符</summary>${unknown}</details>`:''}`;
 }
 const active=bars.findLast(bar=>bar.start<=vocalAt+.0005)?.number;
 if(active!==vocalCurrentBar){
  vocalCurrentBar=active;
  for(const mark of root.querySelectorAll('.vocal-staff-measure.is-current'))mark.classList.remove('is-current');
  for(const mark of root.querySelectorAll(`[data-bar="${active}"]`))mark.classList.add('is-current');
 }
 for(const note of vocalHighlighted)note.classList.remove('is-sounding');
 vocalHighlighted=[...root.querySelectorAll(active===undefined?'.vocal-note':'.is-current .vocal-note')].filter(note=>
  vocalAt>=Number(note.dataset.start)&&vocalAt<Number(note.dataset.end));
 for(const note of vocalHighlighted)note.classList.add('is-sounding');
}
function revealVocalBar(onlyIfNeeded=false){
 const active=document.querySelector('#vocalScore .is-current')||document.querySelector('#vocalScore .is-sounding');
 const system=active?.closest('.vocal-system');
 if(system){
  const controls=document.querySelector('.vocal-controls');
  const panel=$('#vocalPractice');
  const view=panel.getBoundingClientRect(),rect=active.getBoundingClientRect();
  if(onlyIfNeeded&&rect.top>=(controls?.getBoundingClientRect().bottom||view.top)&&rect.bottom<=view.bottom)return;
  panel.scrollTop+=system.getBoundingClientRect().top-view.top-(controls?.offsetHeight||0)-10;
 }
}
