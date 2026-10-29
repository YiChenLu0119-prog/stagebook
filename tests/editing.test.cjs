const assert=require('node:assert/strict'),C=require('../src/core.js');
function fixture(mode='steps'){
 return {id:'song',mode,initial:{a:{x:0,y:0},b:{x:3,y:3}},cues:[
 {id:'first',at:2,duration:3,moves:[{id:'m1',entityId:'a',notes:'first',points:[{x:0,y:0},{x:10,y:0,c1:{x:3,y:4},c2:{x:7,y:4}}]}]},
 {id:'hold',at:5,duration:2,moves:[]},
 {id:'next',at:9,duration:3,moves:[{id:'m2',entityId:'a',notes:'next',points:[{x:10,y:0},{x:20,y:0,c1:{x:13,y:4},c2:{x:17,y:4}}]}]}
 ]};
}
for(const mode of ['steps','timed']){
 const q=fixture(mode),original=C.clone(q);
 assert.deepEqual(C.beforeCue(q,'next','a'),{x:10,y:0});
 assert.deepEqual(C.beforeCue(q,'first','a'),{x:0,y:0});
 C.setDestinations(q,'first',{a:{x:12,y:2}});
 assert.deepEqual(q.cues[0].moves[0].points.at(-1).c2,{x:9,y:6});
 assert.deepEqual(q.cues[2].moves[0].points[0],{x:12,y:2},'Link across a hold');
 assert.deepEqual(q.cues[2].moves[0].points[1].c1,{x:15,y:6});
 assert.equal(q.cues[2].moves[0].points[1].x,20,'Later destinations stay unchanged');
 assert.equal(q.cues[2].moves[0].notes,'next');
 assert.deepEqual(q.cues.map(c=>[c.at,c.duration]),original.cues.map(c=>[c.at,c.duration]));
 C.setDestinations(q,'hold',{b:{x:4,y:4}});
 assert.deepEqual(q.cues[1].moves[0].points,[{x:3,y:3},{x:4,y:4}]);
 assert.equal(q.cues[1].moves[0].entityId,'b');
 C.setInitialPositions(q,{a:{x:-2,y:1}});
 assert.deepEqual(q.cues[0].moves[0].points[0],{x:-2,y:1});
 assert.deepEqual(q.cues[0].moves[0].points[1].c1,{x:1,y:5});
 const mismatch=fixture(mode);mismatch.cues[2].moves[0].points[0].x=15;C.setDestinations(mismatch,'first',{a:{x:12,y:2}});assert.equal(mismatch.cues[2].moves[0].points[0].x,15,'Do not silently repair an unrelated path');
 const unlinked=fixture(mode);C.setDestinations(unlinked,'first',{a:{x:12,y:2}},false);assert.deepEqual(unlinked.cues[2].moves[0].points[0],{x:10,y:0});
}
const q=fixture(),prior=C.clone(q);q.cues.splice(1,0,{id:'inserted',at:0,duration:4,moves:[]});
assert.equal(C.cuePosition(q,'inserted','a').x,10,'Empty next step inherits formation');
assert.deepEqual(q.cues[2],prior.cues[1],'Inserting a step preserves existing content');
assert.throws(()=>C.setDestinations(q,'missing',{a:{x:1,y:1}}));
// Adding a waypoint must preserve the curve, including at a non-midpoint split.
for(const t of [.2,.5,.85]){
 const a={x:-10,y:7},b={x:30,y:-8,c1:{x:-3,y:-22},c2:{x:26,y:15}},points=C.clone([a,b]);
 assert.equal(C.insertRoutePoint(points,1,t),1);
 for(let i=0;i<=100;i++){
  const u=i/100,expected=C.segment(a,b,u),actual=u<=t?C.segment(points[0],points[1],u/t):C.segment(points[1],points[2],(u-t)/(1-t));
  assert(Math.hypot(expected.x-actual.x,expected.y-actual.y)<1e-10,'Split curve retains its exact geometry');
 }
 assert.equal(C.removeRoutePoint(points,0),false);assert.equal(C.removeRoutePoint(points,2),false);
 assert.equal(C.removeRoutePoint(points,1),true);assert.deepEqual(points,[a,{x:b.x,y:b.y}]);
}
console.log('PASS: step/timed manual editing, inherited formations, linked endpoints, tangent preservation, notes/times preserved, optional continuity');
