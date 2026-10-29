const assert=require('node:assert/strict'),C=require('../src/core.js');
for(const curved of [false,true])for(const t of [.1,.25,.5,.75,.9]){
 const points=[{x:-8,y:3},{x:24,y:12,...(curved?{c1:{x:2,y:-7},c2:{x:20,y:-3}}:{})},{x:30,y:10}],before=C.clone(points),grab=C.segment(points[0],points[1],t);
 C.bendSegment(points,1,4,-9,t);
 assert.deepEqual(points[0],before[0]);assert.equal(points[1].x,before[1].x);assert.equal(points[1].y,before[1].y);assert.deepEqual(points[2],before[2]);
 const moved=C.segment(points[0],points[1],t);assert(Math.abs(moved.x-grab.x-4)<1e-8);assert(Math.abs(moved.y-grab.y+9)<1e-8);
}
const vm=require('node:vm'),fs=require('node:fs');
const show=C.newShow(),ctx=vm.createContext({tr:s=>s,ui:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(i<values.length?values[i]:""),""),C,show:()=>show,document:{addEventListener:()=>{}},console});vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/human.js'),'utf8')+'\nglobalThis.api={stageZones,stageRegion,audienceSpace};',ctx);
for(const audience of ['south','north','east','west']){
 show.stage.audience=audience;const zones=ctx.api.stageZones();assert.equal(zones.length,9);for(const z of zones)assert(C.inside(z,C.flatten(show.stage.boundary,true)));
 const p={x:12,y:-7},back=ctx.api.audienceSpace(ctx.api.audienceSpace(p),true);assert.equal(back.x,p.x);assert.equal(back.y,p.y);
 assert(ctx.api.stageRegion(zones.find(z=>z.key==='2-1')).startsWith('前中'));
}
console.log('PASS: direct curve dragging keeps endpoints fixed and follows the pointer; nine stage areas remain valid for all audience directions');
