/* Browser preferences and transport markers are never written to a production. */
const operationDefaults={
 focusTitleOnNewStep:true,rememberSong:true,keepActor:true,repeatLoop:true,showLoopMarks:true,richControlTips:true
};
const operationPrefsKey='stagebook.operation-preferences';
function loadOperationPreferences(){
 try{
  const saved=JSON.parse(localStorage.getItem(operationPrefsKey)||'{}');
  return Object.fromEntries(Object.entries(operationDefaults).map(([key,value])=>[key,typeof saved?.[key]==='boolean'?saved[key]:value]));
 }catch{return {...operationDefaults};}
}
const operationPrefs=loadOperationPreferences();
function updateOperationPreference(key,value){
 operationPrefs[key]=value;
 try{localStorage.setItem(operationPrefsKey,JSON.stringify(operationPrefs));}catch{}
 if(key==='showLoopMarks')updateLoopControls();
 if(key==='rememberSong')renderSongResume();
 if(key==='richControlTips'&&!value&&typeof dismissControlCoach==='function')dismissControlCoach();
}
function operationPreferencesDialog(){
 const settings=[
  ['focusTitleOnNewStep','新建动作后，自动进入标题框'],
  ['rememberSong','打开曲目时，显示上次排练位置'],
  ['keepActor','切歌时，优先保留当前角色'],
  ['richControlTips','显示按钮操作演示'],
  ['showLoopMarks','在播放栏显示 A / B 循环按钮'],
  ['repeatLoop','循环到 B 点后，从 A 点继续播放']
 ];
 const fields=settings.map(([key,label])=>
  '<label class="smallcheck"><input type="checkbox" data-operation-pref="'+key+'" '+(operationPrefs[key]?'checked':'')+
  (key==='richControlTips'?' aria-describedby="controlDemoSettingHint"':'')+'>'+esc(tr(label))+'</label>'+
  (key==='richControlTips'?ui`<p class="muted" id="controlDemoSettingHint">鼠标停在按钮上，或在触屏上长按，可看操作演示。</p>`:'')
 ).join('');
 modal(tr('操作偏好'),ui`<div id="operationPrefsFields" class="operation-prefs">${fields}<p class="muted">只影响这台设备上的浏览器。关闭连续循环后，播放到 B 点会暂停并回到 A 点。</p></div>`);
 $('#operationPrefsFields').onchange=event=>{
  const key=event.target.dataset.operationPref;
  if(Object.hasOwn(operationDefaults,key))updateOperationPreference(key,event.target.checked);
 };
}

let markedA=null;
const loopSongKey=()=>JSON.stringify([showId,songId]);
function activeTransportLoop(){
 return loop?.transport&&loop.song===loopSongKey()&&!singing&&!reminderOpen&&!songVideoOpen?loop:null;
}
function transportLoopStart(){
 return activeTransportLoop()?.start??(markedA?.song===loopSongKey()?markedA.at:null);
}
function setTransportLoop(start,end){
 const key=loopSongKey();
 loop={start,end,transport:true,song:key};
 markedA={song:key,at:start};
}
function resetTransportLoop(){
 markedA=null;
 if(loop?.transport)loop=null;
}
function updateLoopControls(){
 const buttons=$('#transportLoopMarks');
 buttons.classList.toggle('hidden',!operationPrefs.showLoopMarks||singing||reminderOpen||songVideoOpen);
 const range=activeTransportLoop(),start=transportLoopStart();
 for(const [id,pressed,off,on] of [
  ['#markLoopA',start!==null,'设为循环起点 A','清除 A 点并关闭循环'],
  ['#markLoopB',!!range,'设为循环终点 B','清除 B 点并关闭循环']
 ]){
  const button=$(id),label=tr(pressed?on:off);
  if(button.getAttribute('aria-pressed')!==String(pressed))button.setAttribute('aria-pressed',String(pressed));
  if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
  if(button.title!==label)button.title=label;
 }
 $('#clearTransportLoop').classList.toggle('hidden',start===null);
 const status=start===null?'':'A '+fmt(start)+(range?' · B '+fmt(range.end):'');
 if($('#transportLoopStatus').textContent!==status)$('#transportLoopStatus').textContent=status;
}
function markTransportLoop(which){
 if(singing||reminderOpen||songVideoOpen)return;
 const start=transportLoopStart();
 if(which==='clear'||which==='a'&&start!==null){
  resetTransportLoop();renderBottom();updateTransport();return;
 }
 if(which==='b'&&activeTransportLoop()){
  loop=null;renderBottom();updateTransport();return;
 }
 const duration=time(),at=Math.min(duration,Math.max(0,Math.round(current*100)/100));
 if(which==='a'){
  if(!(at<duration)){toast(tr('请在曲目结束前设置 A 点。'));return;}
  if(loop?.transport)loop=null;
  markedA={song:loopSongKey(),at};toast(ui`循环起点 A 已设到 ${fmt(at)}。`);
 }else{
  if(start===null){toast(tr('先把播放指针移到起点，再点 A。'));return;}
  if(!(at>start)){toast(tr('B 点需要在 A 点之后。'));return;}
  setTransportLoop(start,at);toast(ui`循环：${fmt(start)} → ${fmt(at)}`);
 }
 renderBottom();updateTransport();
}
function timelineLoopMarkup(total,pixelsPerSecond){
 if(singing||reminderOpen||songVideoOpen)return '';
 const range=activeTransportLoop(),start=transportLoopStart();
 if(start===null||start>total)return '';
 const x=TIMELINE_LABEL+start*pixelsPerSecond;
 if(!range)return '<span class="timeline-loop-a" aria-hidden="true" style="left:'+x+'px"></span>';
 const width=Math.max(1,(Math.min(total,range.end)-start)*pixelsPerSecond);
 return '<span class="timeline-loop-range" aria-hidden="true" style="left:'+x+'px;width:'+width+'px"></span>';
}
function operationsAction(action){
 switch(action){
 case 'operation-preferences':operationPreferencesDialog();return true;
 case 'transport-loop-a':markTransportLoop('a');return true;
 case 'transport-loop-b':markTransportLoop('b');return true;
 case 'transport-loop-clear':markTransportLoop('clear');return true;
 default:return false;
 }
}
