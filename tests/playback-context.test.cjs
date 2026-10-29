const assert=require('node:assert/strict'),vm=require('node:vm'),{createApp}=require('./app-harness.cjs');
const song=h=>h.api.state().lib.shows[0].songs[0];
function fire(h,type,node,extra={}){for(const fn of h.document.listeners[type]||[])fn({target:node,...extra});}
function actorPointer(h,type,x,y){const actor=new h.Node();actor.dataset.entity='a';actor.closest=s=>s==='[data-entity]'?actor:null;for(const fn of h.$('#stage').listeners[type]||[])fn({button:0,target:actor,clientX:x,clientY:y,pointerId:1});}
(async()=>{
 let h=createApp(),q=song(h);h.api.seek(12);assert.equal(h.api.state().selectedCue,'c2');assert(h.$('#inspector').innerHTML.includes('Step Two'));
 h.api.seek(3);const before=JSON.stringify(q),position=h.C.position(q,'a',3);actorPointer(h,'pointerdown',position.x+.4,position.y+.2);actorPointer(h,'pointerup',position.x+.4,position.y+.2);
 assert.equal(h.api.state().current,3,'A click preserves the playhead');assert.equal(JSON.stringify(q),before,'Selection cannot rewrite an action');assert.equal(vm.runInContext('stagePhase',h.ctx),'live');
 actorPointer(h,'pointerdown',position.x+.4,position.y+.2);actorPointer(h,'pointermove',position.x+4.4,position.y-2.8);actorPointer(h,'pointerup',position.x+4.4,position.y-2.8);
 assert.deepEqual(JSON.parse(JSON.stringify(q.cues[0].moves[0].points.at(-1))),{x:Math.round((position.x+4)*10)/10,y:position.y-3},'Dragging from a preview follows the grab offset without jumping to the old destination');h.api.undo();assert.equal(JSON.stringify(song(h)),before);
 h=createApp();q=song(h);q.cues[0].moves[0].duration=15;q.cues.push({id:'c3',title:'Other simultaneous actor',at:12,duration:4,moves:[{id:'mc',entityId:'b',points:[{x:10,y:3},{x:20,y:3}]}]});q.lyrics=[{id:'lyric',start:13,end:15,text:'同时行动',notes:''}];
 h.api.seekToLyric('lyric');assert.equal(h.api.state().selectedCue,'c1','An actor still moving from an earlier step keeps that actual action selected');h.api.setInspect('entity','b');assert.equal(h.api.state().selectedCue,'c3');assert.equal(h.api.state().current,13);h.api.setInspect('entity','a');assert.equal(h.api.state().selectedCue,'c1');
 const input=new h.Node();input.dataset={humanNote:'a',humanCue:'c1'};input.value='correct current actor';input.matches=s=>s==='[data-human-note]';fire(h,'input',input);assert.equal(q.cues[0].moves[0].notes,input.value);assert.equal(q.cues[2].moves[0].notes,undefined);
 h.api.seek(18);assert.equal(h.api.state().selectedCue,'c3','After an actor finishes, editing follows the current step');h.api.setStepPauses(false);h.api.seek(3);await h.api.play();h.api.advance(15);assert.equal(h.api.state().selectedCue,'c3');assert(h.$('#inspector').innerHTML.includes('Other simultaneous actor'));
 input.matches=()=>true;fire(h,'focusin',input);assert.equal(h.api.state().playing,false,'Starting to type pauses playback before context can change');
 h=createApp();q=song(h);q.cues.forEach(c=>c.at+=5);h.api.seek(1);assert.equal(h.api.state().selectedCue,null);const untouched=JSON.stringify(q);actorPointer(h,'pointerdown',0,0);actorPointer(h,'pointermove',4,4);actorPointer(h,'pointerup',4,4);assert.equal(JSON.stringify(q),untouched,'Before the first step, a drag cannot modify a future action');
 h=createApp();h.api.seek(12);const picker=new h.Node();picker.id='entityPicker';picker.value='';fire(h,'change',picker);assert.equal(h.api.state().selected.length,0);assert.equal(h.api.state().inspect.type,'cue');
 h.api.selectStep('c1');await h.api.preview();h.api.advance(10);assert.equal(h.api.state().selectedCue,'c1','Single-step preview stays pinned through simultaneous/global step boundaries');assert.equal(h.api.state().current,10);
 console.log('PASS: playback/lyrics/seek share actor-aware context, click preserves frame, drag keeps grab offset, overlapping moves edit the right action, typing pauses playback, pre-step protection, clear selection and pinned single-step preview');
})().catch(e=>{console.error(e);process.exitCode=1;});
