const assert=require('node:assert/strict');
const vm=require('node:vm');
const {createApp}=require('./app-harness.cjs');

const stage={audience:'south',boundary:[{x:-50,y:-28},{x:50,y:-28},{x:50,y:28},{x:-50,y:28}],backstage:[],walls:[],anchors:[]};
const formation=[['left',-43,4.8],['middle',-30,4.8],['right',-13,4.8]];
const diagonal=[['a',-38,-21],['b',-24,-13],['c',-10,-5],['d',4,3],['e',18,11],['f',32,19]];

(async()=>{
 const h=createApp();
 const s=h.api.state().lib.shows[0];
 const q=s.songs[0];
 s.stage=stage;
 h.ctx.candidatePoints=diagonal.map(([id,x,y])=>({id,x,y,editable:true}));
 assert.equal(vm.runInContext('alignmentCandidates(candidatePoints,stageFrame(),4).length',h.ctx),0,
  'A diagonal crossing the center line is preserved at maximum tolerance');
 const shallowArc=[['GW',467,633],['JL',536,640],['EH',601,645],['AS',674,647],['PS',727,646],['AB',777,644],['HM',850,637],['LF',926,625]];
 h.ctx.candidatePoints=shallowArc.map(([id,x,y])=>({id,x:(x-674)/6.24,y:(y-513)/6.24,editable:false}));
 const stationaryArc=vm.runInContext('alignmentCandidates(candidatePoints,stageFrame(),4)',h.ctx);
 const arcSpacing=stationaryArc.find(group=>group.label==='沿弧线等距');
 assert(arcSpacing,'The shallow arc in the screenshot should have a suggestion even when the step has no moves');
 assert.equal(arcSpacing.points.length,8);
 assert.equal(arcSpacing.changes.some(({from})=>from.id==='GW'||from.id==='LF'),false,'Arc spacing keeps both ends');
 assert(stationaryArc.some(group=>group.label==='对齐横排'&&group.points.length===8));
 const preview=createApp(),production=preview.api.state().lib.shows[0],song=production.songs[0];
 production.stage=stage;
 production.actors=h.ctx.candidatePoints.map(({id})=>({id,name:id,label:id,color:'#376f7b',notes:''}));
 song.castIds=production.actors.map(actor=>actor.id);
 song.initial=Object.fromEntries(h.ctx.candidatePoints.map(({id,x,y})=>[id,{x,y}]));
 song.cues=[{id:'arc',title:'Arc',at:0,duration:4,moves:[]}];
 preview.api.selectStep('arc');
 preview.$('#alignmentGroups').querySelectorAll=()=>[];
 preview.$('#alignmentTolerance').value='2';
 const unchanged=JSON.stringify(song);
 await preview.api.action('alignment-check');
 assert.match(preview.$('#alignmentGroups').innerHTML,/沿弧线等距/);
 assert.match(preview.$('#alignmentLimitNote').textContent,/提高上限/);
 preview.$('#alignmentTolerance').value='4';
 preview.$('#alignmentTolerance').oninput();
 assert.match(preview.$('#alignmentImpactText').textContent,/会新增/);
 preview.$('#alignmentApply').onclick();
 assert.equal(JSON.stringify(song),unchanged,'Preview and an unconfirmed apply must not create moves');
 preview.$('#alignmentConsent').checked=true;
 preview.$('#alignmentConsent').onchange();
 assert.equal(preview.$('#alignmentApply').disabled,false);
 preview.$('#alignmentApply').onclick();
 assert.equal(song.cues[0].moves.length,arcSpacing.changes.length);
 assert.equal(preview.api.state().history,1);
 preview.api.undo();
 assert.equal(JSON.stringify(preview.api.state().lib.shows[0].songs[0]),unchanged);
 h.ctx.candidatePoints=[{id:'left',x:-40,y:5,editable:true},{id:'middle',x:-20,y:5,editable:true},{id:'right',x:0,y:5,editable:true}];
 const equalRow=vm.runInContext('alignmentCandidates(candidatePoints,stageFrame(),2)',h.ctx);
 assert(equalRow.some(group=>group.label==='拉开横排间距'),'An already straight, equally spaced row allows manual expansion');
 assert(!equalRow.some(group=>group.label==='对齐横排'||group.label==='横排等距'));
 h.ctx.manualRow=equalRow.find(group=>group.label==='拉开横排间距');
 const expand=(anchor,increase)=>vm.runInContext(`alignmentExpansion(manualRow, '${anchor}', ${increase},stageFrame())`,h.ctx);
 const expanded=expand('middle',20).proposal;
 assert.deepEqual(Array.from(expanded.changes,({from,to})=>[from.id,to.x,to.y]),[['left',-44,5],['right',4,5]],
  'The selected actor stays fixed and manual expansion can legally exceed the automatic tolerance');
 assert.match(expand('right',60).message,/超出舞台/);
 h.ctx.manualRow.points[0].editable=false;
 assert(expand('middle',20).proposal.changes.some(({from})=>!from.editable),'Inherited placements are available for preview and explicit confirmation');
 assert(expand('left',20).proposal,'Choosing the stationary actor as anchor allows the existing moves to expand');
 h.ctx.candidatePoints=[{id:'a',x:20,y:-13,editable:true},{id:'b',x:20,y:-3,editable:true},{id:'c',x:20,y:7,editable:true}];
 const column=vm.runInContext("alignmentCandidates(candidatePoints,stageFrame(),2).find(group=>group.label==='拉开竖排间距')",h.ctx);
 assert(column);
 h.ctx.manualRow=column;
 assert.deepEqual(Array.from(expand('b',50).proposal.changes,({to})=>[to.x,to.y]),[[20,-18],[20,12]]);

 s.actors=formation.map(([id])=>({id,name:id,label:id,color:'#376f7b',notes:''}));
 q.castIds=s.actors.map(actor=>actor.id);
 q.initial=Object.fromEntries(formation.map(([id,x,y])=>[id,{x,y}]));
 q.cues=[
  {id:'c1',title:'Position check',at:0,duration:8,moves:[
   {id:'m1',entityId:'middle',points:[{...q.initial.middle},{...q.initial.middle}],startOffset:1,duration:2,notes:'Retain timing'}
  ]},
  {id:'c2',title:'Next step',at:8,duration:4,moves:[
   {id:'m2',entityId:'middle',points:[{...q.initial.middle},{x:-30,y:8,c1:{x:-30,y:5}}]}
  ]}
 ];
 h.api.selectStep('c1');
 h.api.seek(3.5);
 const original=JSON.stringify(q);
 h.$('#alignmentGroups').querySelectorAll=()=>[];
 h.$('#alignmentTolerance').value='0.5';
 await h.api.action('alignment-check');
 assert.equal(h.$('#alignmentApply').disabled,true,'Shifts outside the tolerance are not proposed');
 h.$('#alignmentTolerance').value='2';
 h.$('#alignmentTolerance').oninput();
 assert.match(h.$('#alignmentGroups').innerHTML,/横排等距/,'An already-straight row can still need equal spacing');
 assert.doesNotMatch(h.$('#alignmentGroups').innerHTML,/对齐横排/);
 assert.equal(JSON.stringify(q),original,'Preview and tolerance changes do not change the production');
 assert.equal(h.api.state().history,0);

 h.$('#alignmentApply').onclick();
 const move=q.cues[0].moves[0];
 assert.equal(q.cues[0].moves.length,1,'Stationary endpoint actors serve as references without adding moves');
 assert.deepEqual(move.points.at(-1),{x:-28,y:4.8});
 assert.deepEqual(q.initial.middle,{x:-30,y:4.8});
 assert.deepEqual(q.cues[1].moves[0].points[0],{x:-28,y:4.8},'The linked route start follows the corrected destination');
 assert.deepEqual(q.cues[1].moves[0].points[1].c1,{x:-28,y:5});
 assert.equal(move.startOffset,1);
 assert.equal(move.duration,2);
 assert.equal(h.api.state().current,3.5);
 assert.equal(h.api.state().history,1);
 h.api.undo();
 assert.equal(JSON.stringify(h.api.state().lib.shows[0].songs[0]),original);
 assert.equal(h.api.state().current,3.5);
 console.log('PASS: conservative alignment, tolerance, equal spacing, anchored expansion, stationary references, linked paths, timing and one-step Undo');
})().catch(error=>{console.error(error);process.exitCode=1;});
