const assert=require('node:assert/strict'),C=require('../src/core.js'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(mode='timed'){
 const s=C.newShow('Timing');s.id='timing';s.actors=['a','b'].map(id=>({id,name:id,label:id,color:'#376f7b',notes:''}));s.songs=[{id:'q',title:'Timing',mode,initial:{a:{x:0,y:0},b:{x:0,y:3}},castIds:['a','b'],propIds:[],notes:'',audio:null,lyrics:[],annotations:[],cues:[{id:'c1',title:'One',at:10,duration:10,moves:[{id:'m1',entityId:'a',startOffset:2,duration:3,points:[{x:0,y:0},{x:12,y:0}]},{id:'mb',entityId:'b',points:[{x:0,y:3},{x:10,y:3}]}]},{id:'c2',title:'Two',at:20,duration:5,moves:[]}]}];return{version:1,shows:[s]};
}
for(const mode of ['timed','steps']){
 const lib=fixture(mode),q=lib.shows[0].songs[0],e=C.events(q)[0],start=e.start;
 C.checkStructure(lib);assert.equal(C.position(q,'a',start+1).x,0);assert.equal(C.position(q,'a',start+2).x,0);assert.equal(C.position(q,'a',start+3.5).x,6);assert.equal(C.position(q,'a',start+5).x,12);assert.equal(C.position(q,'a',start+9).x,12);assert.equal(C.position(q,'b',start+5).x,5);
 assert.equal(q.cues[0].duration,10);assert.equal(C.issues(lib.shows[0],q).length,0);
 q.cues[0].moves[0].duration=0;assert.equal(C.position(q,'a',start+1).x,0);assert.equal(C.position(q,'a',start+2).x,12);
 delete q.cues[0].moves[0].startOffset;delete q.cues[0].moves[0].duration;assert.equal(C.position(q,'a',start+5).x,6);
}
// A delayed move from an earlier cue can begin after a later cue: use actual move order.
const lib=fixture(),q=lib.shows[0].songs[0];q.cues[0].moves[0].startOffset=15;q.cues[0].moves[0].duration=3;q.cues[1].moves=[{id:'m2',entityId:'a',duration:2,points:[{x:0,y:0},{x:5,y:0}]}];q.cues[0].moves[0].points[0]={x:5,y:0};assert.equal(C.position(q,'a',23).x,5);assert.equal(C.position(q,'a',26.5).x,8.5);assert.equal(C.total(q),28);assert.equal(C.cuePlaybackEnd(C.events(q)[0]),28);assert.equal(C.issues(lib.shows[0],q).length,0);
q.cues[1].moves[0].duration=8;assert(C.issues(lib.shows[0],q).some(i=>i.text.includes('重叠')));
q.cues[0].moves[0].duration=-1;assert.throws(()=>C.checkStructure(lib));
// Geometry editing must keep the new independent timings.
const edit=fixture(),eq=edit.shows[0].songs[0];C.setDestinations(eq,'c1',{a:{x:14,y:1}});C.bendSegment(eq.cues[0].moves[0].points,1,2,-3);assert.equal(eq.cues[0].moves[0].startOffset,2);assert.equal(eq.cues[0].moves[0].duration,3);
// Extended motion keeps progressing through a later step that has no move for that actor.
const continued=fixture('steps').shows[0].songs[0];continued.cues[0].moves[0].startOffset=0;continued.cues[0].moves[0].duration=30;assert.equal(C.beforeCue(continued,'c2','a').x,4);assert.equal(C.cuePosition(continued,'c2','a').x,6);
console.log('PASS: independent actor starts/durations, hold before/after movement, zero-duration changes, cue-order independence, overlap detection, extended tails, legacy timing and geometry edits');
