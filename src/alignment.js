/* Alignment suggestions run in audience space and never edit until confirmed. */
const MAX_ALIGNMENT_PERCENT=4;

function alignmentDiagonals(points,width){
 const protectedIds=new Set();
 for(const first of points)for(const last of points){
  const dx=last.x-first.x,dy=last.y-first.y;
  if(dx<width*.12||Math.abs(dy)<width*.08||Math.abs(dy/dx)<.22||Math.abs(dy/dx)>4.5)continue;
  const length=Math.hypot(dx,dy);
  const run=points.filter(p=>p.x>=first.x&&p.x<=last.x&&Math.abs(dx*(p.y-first.y)-dy*(p.x-first.x))/length<=width*.007)
   .sort((a,b)=>a.x-b.x);
  if(run.length<3||run.slice(1).some((p,i)=>{
   const gap=Math.hypot(p.x-run[i].x,p.y-run[i].y);return gap<width*.045||gap>width*.26;
  }))continue;
  run.forEach(p=>protectedIds.add(p.id));
 }
 return protectedIds;
}
function alignmentLineSuggestions(points,axis,width,canPlace){
 const along=axis==='x'?'y':'x',ordered=[...points].sort((a,b)=>a[axis]-b[axis]||a.id.localeCompare(b.id));
 const band=width*MAX_ALIGNMENT_PERCENT/100;
 const groups=[];
 for(let i=0;i<ordered.length;i++){
  for(let j=i+2;j<ordered.length;j++){
   if(ordered[j][axis]-ordered[i][axis]>2*band)break;
   const row=ordered.slice(i,j+1).sort((a,b)=>a[along]-b[along]||a.id.localeCompare(b.id));
   const gaps=row.slice(1).map((p,index)=>p[along]-row[index][along]);
   if(gaps.some(gap=>gap<width*.045||gap>width*.28))continue;
   const value=row.reduce((sum,p)=>sum+p[axis],0)/row.length;
   const max=Math.max(...row.map(p=>Math.abs(p[axis]-value)));
   if(max>band)continue;
   const rise=row.slice(1).map((p,k)=>p[axis]-row[k][axis]);
   const slopes=rise.every(v=>v>width*.0025)||rise.every(v=>v< -width*.0025);
   if(slopes&&Math.abs(row.at(-1)[axis]-row[0][axis])/(row.at(-1)[along]-row[0][along])>=.10)continue;
   groups.push({axis,value,points:row,max});
  }
 }
 const used=new Set();
 return groups.sort((a,b)=>b.points.length-a.points.length||a.max-b.max||a.value-b.value).flatMap(group=>{
  if(group.points.some(p=>used.has(p.id)))return [];
  const options=alignmentGroupSuggestions(group,width,canPlace);
  if(options.length)group.points.forEach(p=>used.add(p.id));
  return options;
 });
}
function alignmentArcTargets(points,width){
 if(points.length<5)return null;
 const first=points[0],last=points.at(-1),span=last.x-first.x;
 if(span<width*.25||Math.abs(last.y-first.y)>.12*span)return null;
 const offsets=points.map(p=>p.y-(first.y+(last.y-first.y)*(p.x-first.x)/span));
 const peak=offsets.reduce((best,value,i)=>Math.abs(value)>Math.abs(offsets[best])?i:best,0);
 if(peak<2||peak>points.length-3||Math.abs(offsets[peak])<width*.008)return null;
 const direction=Math.sign(offsets[peak]),noise=width*.003;
 if(offsets.some((value,i)=>{
  if(!i)return false;
  const change=(value-offsets[i-1])*direction;
  return value*direction< -noise||(i<=peak?change< -noise:change>noise);
 }))return null;
 const lengths=[0];
 for(let i=1;i<points.length;i++){
  lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
 }
 let segment=1;
 return points.map((p,i)=>{
  if(i===0||i===points.length-1)return p;
  const distance=lengths.at(-1)*i/(points.length-1);
  while(lengths[segment]<distance)segment++;
  const from=points[segment-1],to=points[segment],t=(distance-lengths[segment-1])/(lengths[segment]-lengths[segment-1]);
  return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
 });
}

function alignmentGroupSuggestions(group,width,canPlace){
 const {axis,points}=group,along=axis==='x'?'y':'x',epsilon=width*.0015;
 const fixed=points.filter(p=>!p.editable);
 const build=(targets,label,guide={})=>{
  const changes=[];
  let furthest=0;
  for(let i=0;i<points.length;i++){
   const from=points[i],to={...from,...targets[i]},distance=Math.hypot(to.x-from.x,to.y-from.y);
   if(distance<epsilon)continue;
   if(!canPlace(to))return null;
   furthest=Math.max(furthest,distance);
   changes.push({from,to});
  }
  const required=furthest/width*100;
  return changes.length&&required<=MAX_ALIGNMENT_PERCENT?{...group,...guide,changes,label,required}:null;
 };
 const first=points[0][along],last=points.at(-1)[along];
 const straight=value=>build(points.map(()=>({[axis]:value})),axis==='x'?'对齐竖排':'对齐横排',{value});
 const fixedValue=fixed[0]?.[axis];
 const keepFixed=fixed.length&&fixed.every(p=>Math.abs(p[axis]-fixedValue)<epsilon);
 const line=keepFixed?straight(fixedValue)??straight(group.value):straight(group.value);
 const arc=axis==='y'?alignmentArcTargets(points,width):null;
 const spaced=arc
  ?build(arc,'沿弧线等距',{curve:points})
  :build(points.map((_,i)=>({[along]:first+(last-first)*i/(points.length-1)})),axis==='x'?'竖排等距':'横排等距');
 return [
  ...(arc?[spaced,line]:[line,spaced]),
  {...group,manual:true,label:axis==='x'?'拉开竖排间距':'拉开横排间距'}
 ].filter(Boolean);
}
function alignmentExpansion(group,anchorId,increase,frame){
 const {axis,points}=group,along=axis==='x'?'y':'x';
 const anchorIndex=points.findIndex(point=>point.id===anchorId),changes=[];
 if(anchorIndex===-1||!(increase>0))return {message:'至少向外拉开一点。'};
 const anchor=points[anchorIndex];
 const gap=(points.at(-1)[along]-points[0][along])/(points.length-1)*(1+increase/100);
 for(let i=0;i<points.length;i++){
  const from=points[i],coordinate=anchor[along]+(i-anchorIndex)*gap;
  if(Math.abs(from[along]-coordinate)<1e-6)continue;
  const to={...from,[along]:coordinate};
  if(!C.inside(audienceSpace(to,true),frame.poly))return {message:'建议位置会超出舞台。请缩小增幅或更换固定演员。'};
  changes.push({from,to});
 }
 return {proposal:{...group,value:anchor[axis],changes}};
}
function alignmentCandidates(points,frame,percent){
 const width=frame.maxX-frame.minX;
 if(!(width>0))return [];
 const limit=width*percent/100,center=(frame.minX+frame.maxX)/2;
 const canPlace=p=>C.inside(audienceSpace(p,true),frame.poly);
 const diagonal=alignmentDiagonals(points,width),eligible=points.filter(p=>!diagonal.has(p.id));
 const centerGroup=eligible.filter(p=>Math.abs(p.x-center)>=width*.0015&&Math.abs(p.x-center)<=limit&&canPlace({...p,x:center}));
 const closeToOther=point=>points.some(other=>other!==point&&Math.abs(other.x-center)<=limit&&Math.abs(other.y-point.y)<width*.035);
 const centerPoints=centerGroup.filter(point=>!closeToOther(point));
 return [
  ...(centerPoints.length?[{axis:'x',value:center,points:centerPoints,label:'靠齐中心线',
   changes:centerPoints.map(from=>({from,to:{...from,x:center}}))}]:[]),
  ...alignmentLineSuggestions(eligible,'y',width,canPlace),
  ...alignmentLineSuggestions(eligible,'x',width,canPlace)
 ];
}

function renderAlignmentStage(points,frame,group){
 const {minX,maxX,minY,maxY,poly}=frame,width=maxX-minX,height=maxY-minY;
 const padding=width*.055,radius=width*.019;
 const preview=$('#alignmentPreview');
 preview.setAttribute('viewBox',`${minX-padding} ${minY-padding} ${width+2*padding} ${height+2*padding}`);
 const boundary=poly.map(point=>audienceSpace(point));
 const center=(minX+maxX)/2;
 const output=[`<path d="${C.path(boundary,true)}" class="alignment-outline"/><path d="M${center} ${minY}V${maxY}" class="alignment-center"/>`];
 if(group){
  const {axis,value,curve}=group;
  const guide=curve?C.path(curve):axis==='x'?`M${value} ${minY}V${maxY}`:`M${minX} ${value}H${maxX}`;
  output.push(`<path d="${guide}" class="alignment-target-line"/>`);
 }
 for(const point of points){
  const name=displayName(point.entity);
  output.push(`<g><title>${esc(name)}</title><circle cx="${point.x}" cy="${point.y}" r="${radius}" fill="${safeColor(point.entity.color)}" class="alignment-dot"/><text x="${point.x}" y="${point.y}" class="alignment-name" font-size="${radius*.88}">${esc(String(point.entity.label||name).slice(0,3))}</text></g>`);
 }
 if(group)for(const {from,to} of group.changes){
  output.push(`<path d="M${from.x} ${from.y}L${to.x} ${to.y}" class="alignment-target-line"/><circle cx="${to.x}" cy="${to.y}" r="${radius*1.18}" class="alignment-target"/>`);
 }
 preview.innerHTML=output.join('');
}
function openAlignmentDialog(){
 if(!canEdit()||singing||songVideoOpen||reminderOpen)return;
 const q=song(),s=show(),initial=tool==='initial',step=initial?null:selectedEvent();
 if(!initial&&!step){toast(tr('先选择一个步骤或起始站位。'));return;}
 pause();
 const revision=editVersion,frame=stageFrame(),existingMoves=new Set(step?.cue.moves.map(move=>move.entityId));
 const points=q.castIds.map(id=>{
  const saved=initial?q.initial[id]:C.cuePosition(q,step.cue.id,id);
  return saved&&entity(id)&&C.inside(saved,frame.poly)?{...audienceSpace(saved),id,entity:entity(id),editable:initial||existingMoves.has(id)}:null;
 }).filter(Boolean);
 const context=initial?tr('起始站位'):[tr('本步落点'),step.cue.title].filter(Boolean).join(' · ');
 modal(tr('检查站位对齐'),ui`
 <div id="alignmentView">
  <div class="alignment-top"><span>${esc(context)}</span><span class="muted">按观众视角显示</span></div>
  <svg id="alignmentPreview" role="img" aria-label="站位对齐预览"></svg>
  <div class="alignment-key"><span class="alignment-original">原位</span><span class="alignment-suggested">建议位置</span></div>
  <label class="alignment-tolerance"><span>最大调整距离</span><output id="alignmentToleranceValue" for="alignmentTolerance"></output><input type="range" id="alignmentTolerance" value="2" min="0.5" max="${MAX_ALIGNMENT_PERCENT}" step="0.5"></label>
  <div id="alignmentGroups"></div>
  <div id="alignmentManual" class="alignment-manual hidden"></div>
  <p id="alignmentLimitNote" class="context-tip hidden" role="status"></p>
  <div id="alignmentImpact" class="alignment-impact hidden">
   <p id="alignmentImpactText" class="muted"></p>
   <label class="smallcheck"><input type="checkbox" id="alignmentConsent">允许为本步新增动作</label>
  </div>
  <div class="dialogactions"><button type="button" id="alignmentCancel">取消</button><button type="button" id="alignmentApply" class="gold">应用这组建议</button></div>
 </div>`);
 const list=$('#alignmentGroups'),slider=$('#alignmentTolerance'),apply=$('#alignmentApply'),manual=$('#alignmentManual');
 const impact=$('#alignmentImpact'),consent=$('#alignmentConsent'),limitNote=$('#alignmentLimitNote');
 let candidates=[],choice=0,proposal=null;
 const exceedsLimit=group=>group?.required>Number(slider.value)+1e-8;
 const newMoves=group=>group?.changes?.filter(({from})=>!from.editable).length||0;
 function canApply(){return !!proposal?.changes.length&&!exceedsLimit(proposal)&&(!newMoves(proposal)||consent.checked);}
 function updateProposal(){
  const group=candidates[choice];
  proposal=group;
  if(group?.manual){
   const increase=+$('#alignmentIncrease').value;
   $('#alignmentIncreaseValue').textContent='+'+increase+'%';
   $('#alignmentIncrease').setAttribute('aria-valuetext',$('#alignmentIncreaseValue').textContent);
   const preview=alignmentExpansion(group,$('#alignmentAnchor').value,increase,frame);
   $('#alignmentMessage').textContent=preview.message?tr(preview.message):'';
   proposal=preview.proposal;
  }
  const count=newMoves(proposal),limited=exceedsLimit(proposal);
  impact.classList.toggle('hidden',!count);
  $('#alignmentImpactText').textContent=count?ui`应用后，本步会新增 ${count} 条演员动作。`:'';
  limitNote.classList.toggle('hidden',!limited);
  limitNote.textContent=limited?ui`这组最远要移动舞台宽度的 ${Math.ceil(proposal.required*10)/10}%。请提高上限后再应用。`:'';
  apply.disabled=!canApply();
  renderAlignmentStage(points,frame,proposal);
 }
 function select(index){
  choice=index;
  consent.checked=false;
  for(const button of list.querySelectorAll('button'))button.setAttribute('aria-pressed',String(+button.dataset.alignmentChoice===choice));
  const group=candidates[choice];
  manual.classList.toggle('hidden',!group?.manual);
  if(group?.manual){
   const anchor=group.points.find(point=>!point.editable)||group.points[Math.floor(group.points.length/2)];
   const options=group.points.map(point=>`<option value="${esc(point.id)}"${point.id===anchor.id?' selected':''}>${esc(displayName(point.entity))}</option>`).join('');
   manual.innerHTML=ui`
    <label class="field"><span>固定演员</span><select id="alignmentAnchor">${options}</select></label>
    <label class="alignment-tolerance"><span>间距增幅</span><output id="alignmentIncreaseValue" for="alignmentIncrease"></output><input type="range" id="alignmentIncrease" value="0" min="0" max="100" step="5" aria-describedby="alignmentBasis"></label>
    <small id="alignmentBasis" class="muted">以这组当前的平均间距为基准。</small>
    <p id="alignmentMessage" class="muted" role="status"></p>`;
   $('#alignmentAnchor').onchange=updateProposal;
   $('#alignmentIncrease').oninput=updateProposal;
  }else manual.innerHTML='';
  updateProposal();
 }
 function recalculate(){
  const percent=+slider.value;
  const previous=candidates[choice];
  $('#alignmentToleranceValue').textContent=ui`舞台宽度的 ${percent}%`;
  slider.setAttribute('aria-valuetext',$('#alignmentToleranceValue').textContent);
  candidates=alignmentCandidates(points,frame,percent);
  list.innerHTML=candidates.map((group,i)=>`<button type="button" data-alignment-choice="${i}"><strong>${esc(tr(group.label))}</strong><small>${esc(group.points.map(p=>displayName(p.entity)).join(' · '))}</small></button>`).join('')||
   ui`<p class="muted">没有找到可预览的调整。可以换一步检查，或先在舞台上调整站位。</p>`;
  const retained=previous?candidates.findIndex(group=>group.label===previous.label&&group.points.length===previous.points.length&&group.points.every((p,i)=>p.id===previous.points[i].id)):-1;
  const available=candidates.findIndex(group=>!group.manual&&!exceedsLimit(group));
  select(retained>=0?retained:available>=0?available:candidates.findIndex(group=>!group.manual));
 }
 list.onclick=event=>{const button=event.target.closest('[data-alignment-choice]');if(button)select(+button.dataset.alignmentChoice);};
 slider.oninput=recalculate;
 consent.onchange=()=>{apply.disabled=!canApply();};
 $('#alignmentCancel').onclick=closeModal;
 apply.onclick=()=>{
  if(!canApply()||!canEdit()||singing||songVideoOpen||reminderOpen)return;
  if(editVersion!==revision||show()!==s||song()!==q||initial!==(tool==='initial')||!initial&&selectedCue!==step.cue.id){
   closeModal();toast(tr('站位已变更，请重新检查。'));return;
  }
  const positions=Object.fromEntries(proposal.changes.map(({to})=>[to.id,audienceSpace(to,true)]));
  snapshot();applyPositions(positions);closeModal();renderAll();toast(tr('已调整站位；⌘Z 可撤销。'));
 };
 recalculate();
 $('#alignmentCancel').focus();
}
