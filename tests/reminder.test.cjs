const assert=require('node:assert/strict'),vm=require('node:vm');
const {createApp}=require('./app-harness.cjs');

(async()=>{
 const h=createApp(),run=code=>vm.runInContext(code,h.ctx),node=id=>h.$('#'+id);
 const value=id=>node(id).textContent;
 const q=h.api.state().lib.shows[0].songs[0];
 const lyrics=node('reminderLyrics'),stage=node('reminderStage');
 const lyricRow=new h.Node('line');
 lyrics.querySelectorAll=()=>[lyricRow];
 node('reminderClips').querySelectorAll=()=>[];
 let capture;
 stage.setPointerCapture=id=>{capture=id;};
 stage.hasPointerCapture=id=>capture===id;
 stage.releasePointerCapture=()=>{capture=null;};
 stage.createSVGPoint=()=>({matrixTransform(){return {x:this.x-20,y:this.y-10};}});
 const pointer=(type,x,y)=>stage.listeners[type][0]({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){}});
 q.lyrics=[{id:'line',start:9,end:12,text:'Look up'}];
 q.cues[0].at=2;
 q.cues[0].stopAfter=true;
 h.api.seek(1.5);
 await h.api.action('mode-reminder');
 assert(node('workspace').classList.contains('reminder-mode'));
 assert.equal(value('reminderCountdown'),'—','Blocking steps do not create lighting cues');
 assert.match(node('reminderActors').innerHTML,/reminder-ghost/);
 node('reminderOnion').checked=false;
 node('reminderOnion').listeners.change[0]();
 assert.doesNotMatch(node('reminderActors').innerHTML,/reminder-ghost/);

 const submit=()=>node('reminderForm').onsubmit({preventDefault(){}});
 await h.api.action('reminder-add');
 assert.equal(node('reminderAt').value,'1.5','A new reminder defaults to the current playhead');
 assert.match(node('dialogBody').innerHTML,/<details id="reminderExact">/);
 node('reminderAt').value='00:06.5';node('reminderText').value='Raise wash';submit();
 assert.equal(q.lightingCues[0].at,6.5);assert.equal(value('reminderCountdown'),'5.0');

 await h.api.action('reminder-add');
 node('reminderLyricPicker').value='line';node('reminderLyricPicker').onchange();
 assert.equal(node('reminderAt').disabled,true);assert.equal(node('reminderAt').value,'9');
 node('reminderText').value='Spot center';submit();
 assert.equal(q.lightingCues[1].lyricId,'line');
 q.lyrics[0].start=10;h.api.renderAll();
 h.api.seek(6.5);
 assert.equal(value('reminderCurrent'),'Raise wash');
 assert.equal(value('reminderNext'),'Spot center');
 assert.equal(value('reminderCountdown'),'3.5','A snapped cue follows retimed lyrics');
 h.api.seek(10);
 assert.equal(value('reminderCurrent'),'Spot center');
 assert.deepEqual({...run('reminderDragTarget(9.37,true)')},{at:10,lyricId:'line'});
 assert.deepEqual({...run('reminderDragTarget(9.37,false)')},{at:9.4});
 assert.equal(value('reminderCountdown'),'—');assert(lyricRow.classList.contains('active'));
 q.lyrics=[];h.api.renderAll();
 assert.equal(run('lightingTimeline(song()).at(-1).at'),9,'A missing lyric falls back to the stored time');

 node('reminderColor').value='#ff0055';
 pointer('pointerdown',10,15);pointer('pointermove',16,19);pointer('pointerup',20,21);
 assert.deepEqual(JSON.parse(JSON.stringify(q.lightingSketches)),[
  {color:'#ff0055',points:[{x:-10,y:5},{x:-4,y:9},{x:0,y:11}]}
 ]);
 assert.match(node('reminderSketches').innerHTML,/#ff0055/);
 pointer('pointerdown',12,16);pointer('pointercancel',12,16);
 assert.equal(q.lightingSketches.length,1);
 assert.equal(h.C.checkStructure(h.api.state().lib),h.api.state().lib);
 const invalid=h.C.clone(h.api.state().lib);
 invalid.shows[0].songs[0].lightingCues[0].at=-1;
 assert.throws(()=>h.C.checkStructure(invalid),/灯光提醒格式无效/);
 await h.api.action('reminder-clear');assert.equal(q.lightingSketches,undefined);
 h.api.undo();assert.equal(h.api.state().lib.shows[0].songs[0].lightingSketches.length,1);

 h.api.seek(1.5);await h.api.action('reminder-play');h.api.advance(7);
 assert.equal(h.api.state().playing,true,'A step configured to pause does not stop the lighting clock');
 assert.equal(value('reminderCurrent'),'Raise wash');
 await h.api.action('mode-edit');
 assert(!node('workspace').classList.contains('reminder-mode'));
 assert.equal(h.api.state().playing,false);
 console.log('PASS: independent cue times, live lyric snapping, stage ghosts, drawing persistence and continuous playback');
})().catch(error=>{console.error(error);process.exitCode=1;});
