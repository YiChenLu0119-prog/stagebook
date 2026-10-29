/* Stagebook data and geometry. No browser or third-party dependencies. */
(function (root) {
  'use strict';
  const tr=(s)=>root.StageI18n?root.StageI18n.translate(s):s;
  const ui=(strings,...values)=>root.StageI18n?root.StageI18n.html(strings,...values):strings.reduce((s,p,i)=>s+p+(i<values.length?values[i]:''),'');
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = prefix => prefix + '-' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12));
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const point = p => !!p && finite(p.x) && finite(p.y);
  function segment(a, b, t) {
    if (point(b.c1) && point(b.c2)) {
      const u = 1 - t;
      return {x:u*u*u*a.x+3*u*u*t*b.c1.x+3*u*t*t*b.c2.x+t*t*t*b.x,
        y:u*u*u*a.y+3*u*u*t*b.c1.y+3*u*t*t*b.c2.y+t*t*t*b.y};
    }
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  }
  // Move the grabbed section of a path while leaving both endpoints fixed.
  function bendSegment(points,index,dx,dy,t=.5){
    const a=points[index-1],b=points[index];if(!point(a)||!point(b))return;
    t=Math.max(.1,Math.min(.9,t));const weight=3*(1-t)*t;
    const c1=b.c1||segment(a,b,1/3),c2=b.c2||segment(a,b,2/3);
    b.c1={x:c1.x+dx/weight,y:c1.y+dy/weight};b.c2={x:c2.x+dx/weight,y:c2.y+dy/weight};
  }
  function insertRoutePoint(points,index,t=.5){
    if(!Array.isArray(points)||index<1||index>=points.length)return -1;
    t=Math.max(.01,Math.min(.99,t));const a=points[index-1],b=points[index];
    if(!point(a)||!point(b))return -1;
    const mix=(p,q)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});let middle;
    if(point(b.c1)&&point(b.c2)){
      const p=mix(a,b.c1),q=mix(b.c1,b.c2),r=mix(b.c2,b),u=mix(p,q),v=mix(q,r);middle={...mix(u,v),c1:p,c2:u};b.c1=v;b.c2=r;
    }else middle=mix(a,b);
    points.splice(index,0,middle);return index;
  }
  function removeRoutePoint(points,index){
    if(!Array.isArray(points)||index<=0||index>=points.length-1)return false;
    points.splice(index,1);delete points[index].c1;delete points[index].c2;return true;
  }
  function flatten(points, close=false) {
    if (!Array.isArray(points) || !points.length || !points.every(point)) return [];
    const out = [{x:points[0].x,y:points[0].y}];
    for (let i=1;i<points.length;i++) {
      const steps=points[i].c1 ? 40 : Math.max(1,Math.ceil(Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y)/2));
      for(let j=1;j<=steps;j++) out.push(segment(points[i-1],points[i],j/steps));
    }
    if(close) out.push({x:points[0].x,y:points[0].y});
    return out;
  }
  function along(points, fraction) {
    const list=flatten(points); if(!list.length)return null;
    const lens=[0]; for(let i=1;i<list.length;i++)lens.push(lens[i-1]+Math.hypot(list[i].x-list[i-1].x,list[i].y-list[i-1].y));
    const target=Math.max(0,Math.min(1,fraction))*lens.at(-1);
    for(let i=1;i<lens.length;i++)if(lens[i]>=target)return segment(list[i-1],list[i],lens[i]===lens[i-1]?0:(target-lens[i-1])/(lens[i]-lens[i-1]));
    return list.at(-1);
  }
  function path(points,close=false) {
    if(!points?.length || !points.every(point))return '';
    return points.map((p,i)=>i===0?`M ${p.x} ${p.y}`:p.c1&&p.c2?`C ${p.c1.x} ${p.c1.y} ${p.c2.x} ${p.c2.y} ${p.x} ${p.y}`:`L ${p.x} ${p.y}`).join(' ')+(close?' Z':'');
  }
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function onLine(p,a,b){return Math.abs(distance(a,p)+distance(p,b)-distance(a,b))<0.02;}
  function inside(p,poly) {
    if(!point(p)||poly.length<3)return false;
    let hit=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];if(onLine(p,a,b))return true;
      if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))hit=!hit;
    }return hit;
  }
  function crosses(a,b,c,d){
    const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
    if(Math.abs(den)<1e-9)return false;
    const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;
    return t>=-1e-8&&t<=1+1e-8&&u>1e-8&&u<1-1e-8;
  }
  function allowed(p,stage){
    return inside(p,flatten(stage.boundary,true))||(stage.backstage||[]).some(z=>inside(p,flatten(z.points,true)));
  }
  function events(song){
    let cursor=0;
    return (song.cues||[]).map((cue,index)=>{
      const duration=finite(cue.duration)&&cue.duration>=0?cue.duration:0;
      const start=song.mode==='steps'?cursor:(finite(cue.at)?cue.at:0);
      cursor+=duration;return {cue,index,start,end:start+duration,duration};
    }).sort((a,b)=>a.start-b.start||a.index-b.index);
  }
  function moveEvent(event,move){
    const start=event.start+(finite(move.startOffset)&&move.startOffset>=0?move.startOffset:0);
    const duration=finite(move.duration)&&move.duration>=0?move.duration:event.duration;
    return {...event,move,start,duration,end:start+duration,cueStart:event.start};
  }
  function moveEvents(song){return events(song).flatMap(e=>(e.cue.moves||[]).map((m,moveIndex)=>({...moveEvent(e,m),moveIndex}))).sort((a,b)=>a.start-b.start||a.index-b.index||a.moveIndex-b.moveIndex);}
  function cuePlaybackEnd(event){return Math.max(event.end,...(event.cue.moves||[]).map(m=>moveEvent(event,m).end));}
  function position(song,entityId,time){
    let p=song.initial?.[entityId];p=point(p)?{x:p.x,y:p.y}:null;
    for(const e of moveEvents(song)){
      if(e.start>time)break;
      if(e.move.entityId===entityId&&e.move.points?.length){
        const current=along(e.move.points,e.duration?Math.min(1,(time-e.start)/e.duration):1);if(current)p=current;
      }
    }return p;
  }
  function beforeCue(song,cueId,entityId){
    const list=events(song),index=list.findIndex(e=>e.cue.id===cueId);
    if(index<0)return clone(song.initial?.[entityId]||null);
    return position({...song,mode:'timed',cues:list.slice(0,index).map(e=>({...e.cue,at:e.start}))},entityId,list[index].start);
  }
  function cuePosition(song,cueId,entityId){
    const move=song.cues.find(c=>c.id===cueId)?.moves.find(m=>m.entityId===entityId);
    if(move)return clone(move.points.at(-1));
    const list=events(song),index=list.findIndex(e=>e.cue.id===cueId);
    if(index<0)return clone(song.initial?.[entityId]||null);
    return position({...song,mode:'timed',cues:list.slice(0,index).map(e=>({...e.cue,at:e.start}))},entityId,cuePlaybackEnd(list[index]));
  }
  function changeRouteStart(move,from,to){
    if(!move||!point(from)||!point(to)||distance(move.points[0],from)>.15)return false;
    const dx=to.x-from.x,dy=to.y-from.y;move.points[0]={x:to.x,y:to.y};
    if(move.points[1]?.c1){move.points[1].c1.x+=dx;move.points[1].c1.y+=dy;}
    return true;
  }
  function setDestinations(song,cueId,positions,linkNext=true){
    const cue=song.cues.find(c=>c.id===cueId);if(!cue)throw Error(tr('请先选择一个走台步骤。'));
    const list=events(song),index=list.findIndex(e=>e.cue.id===cueId);
    for(const [entityId,to]of Object.entries(positions)){
      if(!point(to))throw Error(tr('位置必须是有效坐标。'));
      const from=beforeCue(song,cueId,entityId),old=cuePosition(song,cueId,entityId);if(!from)continue;
      let move=cue.moves.find(m=>m.entityId===entityId);
      if(!move){move={id:id('move'),entityId,points:[{x:from.x,y:from.y},{x:from.x,y:from.y}],notes:''};cue.moves.push(move);}
      const end=move.points.at(-1),dx=to.x-end.x,dy=to.y-end.y;
      end.x=to.x;end.y=to.y;if(end.c2){end.c2.x+=dx;end.c2.y+=dy;}
      if(linkNext){const next=list.slice(index+1).map(e=>e.cue.moves.find(m=>m.entityId===entityId)).find(Boolean);changeRouteStart(next,old,to);}
    }
  }
  function setInitialPositions(song,positions,linkNext=true){
    for(const [entityId,to]of Object.entries(positions)){
      if(!point(to))throw Error(tr('位置必须是有效坐标。'));
      if(linkNext){const next=events(song).map(e=>e.cue.moves.find(m=>m.entityId===entityId)).find(Boolean);changeRouteStart(next,song.initial[entityId],to);}
      song.initial[entityId]={x:to.x,y:to.y};
    }
  }
  function removeActions(song,cueId,entityIds=null,linkNext=true){
    const cue=song.cues.find(c=>c.id===cueId);if(!cue)return;
    const list=events(song),index=list.findIndex(e=>e.cue===cue),removed=cue.moves.filter(m=>entityIds===null||entityIds.includes(m.entityId)),links=[];
    if(linkNext)for(const move of removed){
      const next=list.slice(index+1).map(e=>e.cue.moves.find(m=>m.entityId===move.entityId)).find(Boolean);
      if(next&&point(move.points.at(-1)))links.push({next,entityId:move.entityId,from:clone(move.points.at(-1))});
    }
    if(entityIds===null)song.cues.splice(song.cues.indexOf(cue),1);else cue.moves=cue.moves.filter(m=>!entityIds.includes(m.entityId));
    const after=events(song);
    for(const link of links){
      const nextIndex=after.findIndex(e=>e.cue.moves.includes(link.next));if(nextIndex<0)continue;
      const prior={...song,mode:'timed',cues:after.slice(0,nextIndex).map(e=>({...e.cue,at:e.start}))},to=position(prior,link.entityId,moveEvent(after[nextIndex],link.next).start);
      changeRouteStart(link.next,link.from,to);
    }
  }
  function total(song,audioDuration=0){
    const computed=Math.max(0,...events(song).map(cuePlaybackEnd),...(song.lyrics||[]).map(l=>finite(l.end)?l.end:0));
    return Math.max(computed,finite(song.duration)?song.duration:0,finite(audioDuration)?audioDuration:0,1);
  }
  function issues(show,song){
    const out=[];const add=(text,type,id,level='error')=>out.push({text,type,id,level});
    const actors=show.actors||[],props=show.props||[],ids=new Set([...actors,...props].map(a=>a.id));
    const cast=new Set([...(song.castIds||[]),...(song.propIds||[])]);
    const seen=new Set();
    for(const o of [...actors,...props,...(song.cues||[]),...(song.cues||[]).flatMap(c=>c.moves||[]),...(song.lyrics||[]),...(song.annotations||[]),...(show.stage.anchors||[]),...(show.stage.walls||[]),...(show.stage.backstage||[])]){
      if(!o.id||seen.has(o.id))add(tr('对象 ID 缺失或重复：')+(o.id||o.name||o.title||tr('未命名')),'song',song.id);seen.add(o.id);
    }
    for(const entity of cast){
      if(!ids.has(entity))add(tr('参演名单引用了不存在的对象：')+entity,'song',song.id);
      const p=song.initial?.[entity];
      if(!point(p))add(tr('缺少起始位置：')+entity,'entity',entity);
      else if(!allowed(p,show.stage))add(tr('起始位置超出舞台／后台：')+entity,'entity',entity);
    }
    for(const e of events(song)){
      if(!finite(e.cue.duration)||e.cue.duration<0 || (song.mode!=='steps'&&(!finite(e.cue.at)||e.cue.at<0)))add(tr('走台时间必须为非负秒数'),'cue',e.cue.id);
      for(const m of e.cue.moves||[]){
        if(!cast.has(m.entityId))add(tr('路线引用了未参演或不存在的对象：')+m.entityId,'move',m.id);
        if(!Array.isArray(m.points)||m.points.length<2||!m.points.every(point)||m.points.some(p=>(!!p.c1!==!!p.c2)||(p.c1&&(!point(p.c1)||!point(p.c2))))){add(tr('路线至少需要两个有效坐标点；曲线需要两个控制点'),'move',m.id);continue;}
        if(m.gateId&&!(show.stage.anchors||[]).some(a=>a.id===m.gateId))add(tr('路线引用了不存在的出入口：')+m.gateId,'move',m.id);
        const line=flatten(m.points);
        if(line.some(p=>!allowed(p,show.stage)))add(tr('路线超出舞台及允许的后台范围'),'move',m.id);
        if((show.stage.walls||[]).some(w=>{
          const wall=flatten(w.points);for(let i=1;i<line.length;i++)for(let j=1;j<wall.length;j++)if(crosses(line[i-1],line[i],wall[j-1],wall[j]))return true;return false;
        }))add(tr('路线穿过墙，请调整路线或通过上下场口'),'move',m.id);
        for(const key of ['startOffset','duration'])if(m[key]!==undefined&&(!finite(m[key])||m[key]<0))add(tr('演员移动的开始偏移和时长必须是非负秒数'),'move',m.id);

      }
    }
    const spans={};
    for(const e of moveEvents(song)){
      const m=e.move,previous=spans[m.entityId]||[];
      if(previous.some(p=>e.start<p.end-1e-6&&e.end>p.start+1e-6))add(tr('同一对象的两段移动时间重叠：')+m.entityId,'move',m.id);
      const before=position({...song,mode:'timed',cues:previous.map(p=>({...p.cue,at:p.cueStart,moves:[p.move]}))},m.entityId,e.start);
      if(before&&point(m.points?.[0])&&distance(before,m.points[0])>.15)add(tr('路线起点与此前位置不一致，播放时会跳动'),'move',m.id,'warning');
      previous.push(e);spans[m.entityId]=previous;
    }
    for(const l of song.lyrics||[])if(!finite(l.start)||!finite(l.end)||l.start<0||l.end<l.start)add(tr('歌词开始／结束时间无效'),'lyric',l.id);
    for(const n of song.annotations||[]){if((n.start!=null&&(!finite(n.start)||n.start<0))||(n.end!=null&&(!finite(n.end)||n.end<0))||(n.start!=null&&n.end!=null&&n.end<n.start))add(tr('记录的时间范围无效'),'annotation',n.id);for(const id of n.entityIds||[])if(!ids.has(id))add(tr('记录引用了不存在的对象：')+id,'annotation',n.id);}
    return out;
  }
  function checkStructure(lib){
    if(!lib||lib.version!==1||!Array.isArray(lib.shows))throw Error(tr('需要 version: 1 和 shows 数组。'));
    const showIds=new Set();
    for(const s of lib.shows){
      if(typeof s.id!=='string'||!/^[A-Za-z0-9_-]+$/.test(s.id)||showIds.has(s.id))throw Error(tr('演出 ID 必须唯一，仅含英文字母、数字、横线和下划线。'));showIds.add(s.id);
      if(!s.stage||!Array.isArray(s.stage.boundary)||s.stage.boundary.length<3||!s.stage.boundary.every(point))throw Error(s.title+tr('：舞台 boundary 至少需要三个有效坐标点。'));
      if(s.pauseAtSteps!==undefined&&typeof s.pauseAtSteps!=='boolean')throw Error(tr('pauseAtSteps 必须为布尔值。'));
      const validControls=points=>points.every(p=>(p.c1===undefined&&p.c2===undefined)||(point(p.c1)&&point(p.c2)));
      if(!validControls(s.stage.boundary))throw Error(tr('舞台曲线需要两个有效控制点。'));
      for(const key of ['actors','props','songs'])if(!Array.isArray(s[key]))throw Error(s.id+tr(' 缺少数组 ')+key);
      s.stage.anchors ||= [];s.stage.walls ||= [];s.stage.backstage ||= [];
      for(const key of ['anchors','walls','backstage'])if(!Array.isArray(s.stage[key]))throw Error(tr('舞台 ')+key+tr(' 必须为数组。'));
      for(const z of [...s.stage.walls,...s.stage.backstage])if(!Array.isArray(z.points)||z.points.length<2||!z.points.every(point)||!validControls(z.points))throw Error(tr('舞台区域或墙坐标无效。'));
      for(const a of s.stage.anchors)if(!point(a))throw Error(tr('舞台标记坐标无效。'));
      for(const o of [...s.actors,...s.props,...s.stage.anchors,...s.stage.walls,...s.stage.backstage])if(!o||typeof o.id!=='string')throw Error(tr('角色、道具和舞台对象需要字符串 ID。'));
      const songIds=new Set();
      for(const song of s.songs){
        if(!song.id||!/^[A-Za-z0-9_-]+$/.test(song.id)||songIds.has(song.id))throw Error(tr('曲目 ID 无效或重复。'));songIds.add(song.id);
        if(!['timed','steps'].includes(song.mode))throw Error(song.id+tr('：mode 必须为 timed 或 steps。'));
        for(const key of ['castIds','propIds','cues','lyrics','annotations'])song[key] ||= [];
        if(!song.initial||typeof song.initial!=='object')song.initial={};
        for(const key of ['castIds','propIds','cues','lyrics','annotations'])if(!Array.isArray(song[key]))throw Error(song.id+'：'+key+tr(' 必须为数组。'));
        for(const key of ['castIds','propIds'])if(!song[key].every(id=>typeof id==='string'))throw Error(tr('参演名单只能包含字符串 ID。'));
        for(const o of [...song.cues,...song.lyrics,...song.annotations])if(!o||typeof o.id!=='string')throw Error(tr('走台步骤、歌词和记录需要字符串 ID。'));
        for(const c of song.cues){if(!Array.isArray(c.moves))throw Error(tr('每一步都需要 moves 数组。'));for(const m of c.moves)if(!m||typeof m.id!=='string'||!Array.isArray(m.points)||!m.points.every(point)||!validControls(m.points))throw Error(tr('路线需要 ID 及有效坐标 points 数组。'));else for(const key of ['startOffset','duration'])if(m[key]!==undefined&&(!finite(m[key])||m[key]<0))throw Error(tr('演员移动时间需要非负秒数。'));}
        for(const n of song.annotations)if(n.entityIds!==undefined&&(!Array.isArray(n.entityIds)||!n.entityIds.every(id=>typeof id==='string')))throw Error(tr('记录 entityIds 必须为字符串数组。'));
        if(song.audio&&!safePath(song.audio.file))throw Error(tr('音频必须是曲目文件夹内的相对路径。'));
      }
    }return lib;
  }
  function safePath(path){return typeof path==='string'&&path.length>0&&!path.startsWith('/')&&!path.includes('\\')&&!path.split('/').some(p=>!p||p==='.'||p==='..')&&!/^[a-z]+:/i.test(path);}
  function newSong(title=tr('未命名曲目')){return {id:id('song'),title,notes:'',mode:'steps',audio:null,duration:null,castIds:[],propIds:[],initial:{},lyrics:[],cues:[],annotations:[]};}
  function newShow(title=tr('新演出')){return {id:id('show'),title,notes:'',actors:[],props:[],songs:[newSong(tr('第一首曲目'))],stage:{notes:'',audience:'south',boundary:[{x:-60,y:-35},{x:60,y:-35},{x:60,y:25},{x:-60,y:25,c1:{x:45,y:55},c2:{x:-45,y:55}}],backstage:[{id:'back-left',name:tr('左后台'),notes:'',points:[{x:-85,y:-15},{x:-60,y:-15},{x:-60,y:15},{x:-85,y:15}]},{id:'back-right',name:tr('右后台'),notes:'',points:[{x:60,y:-15},{x:85,y:-15},{x:85,y:15},{x:60,y:15}]}],walls:[{id:'wall-l1',name:tr('左墙上'),notes:'',points:[{x:-60,y:-35},{x:-60,y:-10}]},{id:'wall-l2',name:tr('左墙下'),notes:'',points:[{x:-60,y:10},{x:-60,y:25}]},{id:'wall-r1',name:tr('右墙上'),notes:'',points:[{x:60,y:-35},{x:60,y:-10}]},{id:'wall-r2',name:tr('右墙下'),notes:'',points:[{x:60,y:10},{x:60,y:25}]}],anchors:[{id:'gate-left',name:tr('左入口'),kind:'gate',x:-60,y:0,notes:''},{id:'gate-right',name:tr('右入口'),kind:'gate',x:60,y:0,notes:''},{id:'center',name:tr('中心'),kind:'mark',x:0,y:0,notes:''}]}};}
  const api={clone,id,finite,point,segment,bendSegment,insertRoutePoint,removeRoutePoint,flatten,along,path,inside,crosses,allowed,events,moveEvent,moveEvents,cuePlaybackEnd,position,beforeCue,cuePosition,setDestinations,setInitialPositions,removeActions,total,issues,checkStructure,safePath,newSong,newShow};
  root.StageCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
