const controlCoachGroups=[
 [['open'],'import','导入演出包，打开走位、歌词和音频。'],
 [['save','save-folder'],'save','把当前演出的修改存下来。'],
 [['export','export-all'],'share','把演出打包给其他人。'],
 [['mode-edit','tool-initial','tool-select'],'stage','在舞台上摆角色和走位路径。'],
 [['mode-rehearse'],'walk','选一个角色，看他接下来怎么走。'],
 [['mode-sing'],'lyrics','跟着歌词练唱，或单独练声部。'],
 [['mode-song-video'],'video','看实录，重放需要复习的片段。'],
 [['mode-reminder'],'cue','跟着倒计时看下一条灯光提示。'],
 [['feature-find'],'search','输入想做的事，找到对应入口。'],
 [['play','reminder-play','song-video-play','vocal-play'],'play','开始或暂停当前位置的播放。'],
 [['seek-time'],'seek','把播放指针移到指定时间。'],
 [['bottom-timeline'],'timeline','打开时间轴，查看步骤和各角色的行动轨道。'],
 [['human-next-step'],'insert','在播放指针处加入一步。'],
 [['human-preview'],'preview','只试看选中的这一步。'],
 [['edit-copy-playhead-dialog'],'copy','在播放指针处放一份所选步骤的副本。'],
 [['timeline-selected-only'],'filter','只显示选中角色和道具的轨道。'],
 [['timeline-zoom-in','reminder-zoom-in'],'zoom-in','改变时间轴的显示比例，动作时长保持原样。'],
 [['timeline-zoom-out','reminder-zoom-out'],'zoom-out','改变时间轴的显示比例，动作时长保持原样。'],
 [['timeline-fit','reminder-fit'],'zoom-out','让整首曲目的时间轴都放进窗口。'],
 [['transport-loop-a','song-video-mark-start'],'a','把当前位置设为循环起点，再点一次可清除。'],
 [['transport-loop-b','song-video-mark-end'],'b','把当前位置设为循环终点，再点一次可清除。'],
 [['transport-loop-clear'],'clear-loop','清除 A / B 标记，恢复正常播放。'],
 [['lyrics-toggle'],'lyrics','在舞台旁显示或收起歌词。'],
 [['bottom-lyrics'],'lyrics','打开歌词面板。'],
 [['lyrics'],'import','把带时间的歌词导入当前曲目。'],
 [['add-lyric'],'insert','在播放指针处添加一行歌词。'],
 [['audio','reminder-audio'],'audio','连接音频，让播放跟着音乐走。'],
 [['stage-fullscreen','reminder-fullscreen','song-video-fullscreen','sing-fullscreen'],'fullscreen','把当前视图放大到全屏。'],
 [['layout-stage'],'focus-stage','让舞台占用更多的编辑空间。'],
 [['alignment-check'],'align','预览一组角色对齐后的站位。'],
 [['song-video-add'],'video','将排练录像关联到当前曲目。'],
 [['song-video-loop','loop','sing-passage'],'loop','把要反复看的片段设为循环。'],
 [['reminder-add'],'cue-add','在当前位置添加一条灯光提醒。'],
 [['reminder-next'],'cue','跳到相邻的灯光提示，并暂停在那里。'],
 [['reminder-previous'],'cue-prev','跳到相邻的灯光提示，并暂停在那里。'],
 [['reminder-lock'],'lock','锁住编辑，同时保留播放和切换提示。'],
 [['undo','redo'],'undo','撤销或重做走台修改。'],
 [['bottom-steps','bottom-notes','human-prev','human-next','previous','next','human-start','human-end','human-step-details'],'preview','查看这一刻的站位、备注和动作。'],
 [['sing-vocal'],'audio','在声部之间切换，练习对应的音。']
];
const controlCoachCatalog=new Map(controlCoachGroups.flatMap(([actions,kind,description])=>actions.map(action=>[action,{kind,description}])));

function coachBox(x,y,w,h,classes='coach-panel',rx=4){return '<rect class="'+classes+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+'"/>';}
function coachDot(x,y,r,classes='coach-accent'){return '<circle class="'+classes+'" cx="'+x+'" cy="'+y+'" r="'+r+'"/>';}
function coachPath(d,classes='coach-line'){return '<path class="'+classes+'" d="'+d+'"/>';}
function coachStage(kind){
 const stage=coachBox(22,14,176,65)+coachPath('M34 65Q110 81 186 65M110 18v44','coach-line coach-back');
 if(kind==='align')return stage+coachPath('M48 54h126','coach-line coach-align-guideline')+coachDot(59,42,6,'coach-accent coach-align-one')+coachDot(110,62,6,'coach-accent coach-align-two')+coachDot(161,45,6,'coach-accent coach-align-three');
 return stage+coachDot(72,55,6,'coach-secondary')+coachDot(154,49,6,'coach-secondary')+
  coachPath('M88 53Q117 20 144 32','coach-line coach-guide')+coachDot(88,53,7,'coach-accent coach-actor')+
  (kind==='walk'?coachDot(144,32,8,'coach-ring coach-rehearsal-ring'):'');
}
function coachTimeline(kind){
 const markers='<path class="coach-line coach-back" d="M35 21v7m19-7v4m19-4v4m19-4v7m19-7v4m19-4v4m19-4v7m19-7v4m19-4v4"/>';
 const playhead='<g class="coach-playhead"><path class="coach-line coach-action-line" d="M109 21v55"/>'+coachPath('M105 20h8l-4 5z','coach-accent')+'</g>';
 let content=coachBox(26,13,168,67)+markers;
 if(kind==='filter')return content+coachBox(42,32,66,9)+coachBox(93,47,77,9,'coach-accent')+coachBox(57,62,54,9)+
  coachBox(42,32,66,9,'coach-muted-track')+coachBox(57,62,54,9,'coach-muted-track')+coachBox(145,63,36,8,'coach-ring coach-beat');
 if(['a','b','a-clear','b-clear','loop','clear-loop'].includes(kind)){
  const endpoints='<g class="coach-marker-a">'+coachPath('M60 35v35','coach-line coach-action-line')+
   '<text x="60" y="32">A</text></g><g class="coach-marker-b">'+coachPath('M154 35v35','coach-line coach-action-line')+
   '<text x="154" y="32">B</text></g>';
  content+=coachBox(60,37,94,33,'coach-marked-range')+coachBox(63,48,38,9,'coach-secondary')+coachBox(106,48,44,9,'coach-secondary')+endpoints;
  return content+playhead;
 }
 const clips='<g class="coach-clips">'+coachBox(42,34,48,10,'coach-secondary')+coachBox(139,34,42,10,'coach-secondary')+
  coachBox(59,51,49,10,'coach-secondary')+coachBox(118,51,50,10,'coach-secondary')+'</g>';
 content+=clips;
 if(kind==='insert'||kind==='copy')content+=coachBox(109,34,24,10,'coach-accent coach-new-clip');
 if(kind==='undo')content+=coachBox(109,34,24,10,'coach-accent coach-removed-clip');
 if(kind==='preview')content+=coachBox(42,33,48,12,'coach-ring coach-beat');
 return content+playhead;
}
function coachMedia(kind){
 const surface=coachBox(32,13,156,67);
 if(kind==='audio')return surface+coachPath('M48 46h11m8-8v16m10-28v40m11-31v22m11-35v48m11-31v14m11-24v34m11-26v18m11-29v40m11-31v22m9-11h11','coach-line coach-action-line coach-wave')+coachPath('M47 70h126','coach-line coach-back');
 if(kind==='lyrics')return surface+coachBox(60,34,98,16,'coach-ring coach-lyric-highlight')+
  coachPath('M70 27h61M70 42h78M70 57h58M70 70h45','coach-line coach-lyric-text');
 return surface+coachBox(42,21,136,40,'coach-window')+
  coachPath('M49 53l20-13 18 9 31-21 26 17 8-6 19 12','coach-line coach-back')+coachDot(112,41,12,'coach-ring coach-beat')+
  coachPath('M109 35l9 6-9 6z','coach-accent')+
  coachPath('M45 70h130','coach-line coach-back')+coachDot(60,70,4,'coach-accent coach-video-head');
}
function coachDocument(kind){
 const documentArt=coachPath('M64 19h31l12 12v40H64z','coach-window')+
  coachPath('M95 19v12h12M73 42h24m-24 9h24m-24 9h16','coach-line');
 const folder=coachPath('M120 36V25h17l7 7h20v41h-44z','coach-window');
 const transfer=kind==='import'?'M150 48H96m5-6-6 6 6 6':'M89 48h61m-6-6 6 6-6 6';
 return documentArt+folder+coachPath(transfer,'coach-line coach-action-line coach-transfer')+
  (kind==='save'?coachPath('M139 56l5 5 10-10','coach-line coach-action-line coach-beat'):'');
}
function coachUtility(kind){
 if(kind==='search')return coachBox(36,16,148,64)+coachBox(47,25,124,17,'coach-ring')+
  coachDot(57,33,4,'coach-ring')+coachPath('M60 36l4 3m15-6h42M53 51h66m-66 13h89','coach-line')+
  coachBox(47,45,124,12,'coach-marker-match');
 if(kind==='fullscreen'||kind==='focus-stage')return coachBox(34,15,152,64,'coach-panel')+
  coachBox(66,29,88,36,'coach-window coach-expand')+
  coachPath('M44 30v-7h9m123 7v-7h-9M44 64v7h9m123-7v7h-9','coach-line coach-action-line');
 if(kind==='lock')return coachBox(34,13,152,66)+coachPath('M48 69h124m-110-6v12m47-12v12m47-12v12','coach-line coach-back')+
  coachBox(96,34,28,21,'coach-accent coach-beat')+
  coachPath('M102 34v-7a8 8 0 0 1 16 0v7','coach-line coach-action-line')+coachDot(110,43,2,'coach-dark');
 return coachBox(27,13,166,66)+coachDot(62,38,12,'coach-ring coach-beat')+
  coachPath('M94 30h60m-60 14h40M47 65h126','coach-line')+
  coachDot(67,65,4,'coach-secondary')+coachDot(109,65,5,'coach-accent coach-cue-dot')+coachDot(151,65,4,'coach-secondary');
}
function coachDemo(kind){
 let art;
 if(['stage','walk','align'].includes(kind))art=coachStage(kind);
 else if(['seek','timeline','insert','copy','filter','zoom-in','zoom-out','a','b','a-clear','b-clear','loop','clear-loop','undo','preview'].includes(kind))art=coachTimeline(kind);
 else if(['audio','lyrics','video','play'].includes(kind))art=coachMedia(kind);
 else if(['import','save','share'].includes(kind))art=coachDocument(kind);
 else art=coachUtility(kind);
 return '<svg class="coach-demo coach-demo-'+kind+'" viewBox="0 0 220 92" aria-hidden="true" focusable="false">'+art+'</svg>';
}

let controlCoachCard,controlCoachTarget,controlCoachTimer,controlCoachKeyboard=false;
let heldControlCoach=null,suppressedCoachClick=null;
const controlCoachId='controlCoach';
function dismissControlCoach(){
 clearTimeout(controlCoachTimer);
 controlCoachTimer=0;heldControlCoach=null;
 if(controlCoachTarget&&controlCoachCard&&!controlCoachCard.hidden){
  const rest=(controlCoachTarget.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==controlCoachId);
  if(rest.length)controlCoachTarget.setAttribute('aria-describedby',rest.join(' '));
  else controlCoachTarget.removeAttribute('aria-describedby');
 }
 if(controlCoachCard)controlCoachCard.hidden=true;
 controlCoachTarget=null;
}
function controlCoachFor(button){
 const action=button?.dataset.action;
 const content=controlCoachCatalog.get(action);
 if(!content)return null;
 if((action==='transport-loop-a'||action==='transport-loop-b')&&button.getAttribute('aria-pressed')==='true'){
  return {kind:content.kind+'-clear',description:'清除这个标记，并停止局部循环。'};
 }
 // Video uses dedicated marker commands. Its loop toggle is independent of the song timeline.
 if(action==='song-video-mark-start'||action==='song-video-mark-end'){
  const key=action==='song-video-mark-start'?'设为循环起点 A':'设为循环终点 B';
  return {kind:content.kind,description:key};
 }
 return content;
}
function controlCoachAllowed(button){
 if(!operationPrefs.richControlTips||!button?.isConnected||button.matches(':disabled,[aria-disabled="true"]')||
  button.closest('[inert],dialog,#contextMenu,#tutorialCard,[hidden]')||!button.getClientRects().length)return false;
 return !$('#dialog')?.open&&!$('#featureFinder')?.open&&tutorialIndex<0&&!stageFullscreenMode&&
  !singingPresentation.active()&&!songVideoPresentation.active()&&!reminderPresentation.active();
}
function showControlCoach(button){
 if(!controlCoachAllowed(button)){dismissControlCoach();return;}
 const content=controlCoachFor(button);
 if(!content)return;
 const explicitLabel=button.getAttribute('aria-label')||button.title;
 const label=(explicitLabel||(content.kind==='play'?tr('播放'):button.textContent)).trim();
 if(!label)return;
 if(!controlCoachCard){
  controlCoachCard=document.createElement('aside');
  controlCoachCard.id=controlCoachId;
  controlCoachCard.setAttribute('role','tooltip');
  document.body.append(controlCoachCard);
 }
 controlCoachCard.innerHTML=coachDemo(content.kind)+'<div class="coach-copy"><strong>'+
  esc(label)+'</strong><p>'+esc(tr(content.description))+'</p></div>';
 controlCoachCard.hidden=false;
 const target=button.getBoundingClientRect(),card=controlCoachCard.getBoundingClientRect();
 const pad=10,gap=9,w=window.innerWidth,h=window.innerHeight;
 const clamp=(value,upper)=>Math.max(pad,Math.min(value,upper-pad));
 if(!target.width||!target.height||target.right<=0||target.bottom<=0||target.left>=w||target.top>=h){dismissControlCoach();return;}
 let x,y;
 if(target.bottom+gap+card.height<=h-pad){x=target.left;y=target.bottom+gap;}
 else if(target.top-gap-card.height>=pad){x=target.left;y=target.top-gap-card.height;}
 else if(target.right+gap+card.width<=w-pad){x=target.right+gap;y=target.top;}
 else if(target.left-gap-card.width>=pad){x=target.left-gap-card.width;y=target.top;}
 else{dismissControlCoach();return;}
 controlCoachCard.style.left=clamp(x,w-card.width)+'px';
 controlCoachCard.style.top=clamp(y,h-card.height)+'px';
 const descriptions=(button.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==controlCoachId);
 descriptions.push(controlCoachId);
 button.setAttribute('aria-describedby',descriptions.join(' '));
}
function scheduleControlCoach(button){
 if(!controlCoachAllowed(button)||!controlCoachFor(button))return;
 if(button===controlCoachTarget)return;
 dismissControlCoach();
 controlCoachTarget=button;
 controlCoachTimer=setTimeout(()=>{
  controlCoachTimer=0;
  showControlCoach(button);
 },720);
}
document.addEventListener('pointerover',event=>{
 if(event.pointerType==='touch')return;
 scheduleControlCoach(event.target.closest?.('button[data-action]'));
});
document.addEventListener('pointerout',event=>{
 if(event.pointerType==='touch')return;
 if(event.target.closest?.('button[data-action]')===controlCoachTarget&&!controlCoachTarget?.contains(event.relatedTarget)){
  dismissControlCoach();
 }
});
function revealHeldCoach(){
 if(!heldControlCoach||heldControlCoach.shown)return;
 const press=heldControlCoach;
 clearTimeout(controlCoachTimer);controlCoachTimer=0;
 controlCoachTarget=press.button;
 showControlCoach(press.button);
 press.shown=Boolean(controlCoachTarget===press.button&&controlCoachCard&&!controlCoachCard.hidden);
}
document.addEventListener('pointerdown',event=>{
 controlCoachKeyboard=false;dismissControlCoach();
 if(event.isPrimary!==false)suppressedCoachClick=null;
 if(event.pointerType!=='touch'||event.isPrimary===false)return;
 const button=event.target.closest?.('button[data-action]');
 if(!controlCoachAllowed(button)||!controlCoachFor(button))return;
 heldControlCoach={button,id:event.pointerId,x:event.clientX,y:event.clientY,shown:false};
 controlCoachTimer=setTimeout(revealHeldCoach,650);
},true);
document.addEventListener('pointermove',event=>{
 const press=heldControlCoach;if(press?.id!==event.pointerId||!press)return;
 if(Math.abs(event.clientX-press.x)>10||Math.abs(event.clientY-press.y)>10)dismissControlCoach();
},true);
function finishHeldCoach(event){
 const press=heldControlCoach;
 if(!press||press.id!==event.pointerId)return;
 if(!press.shown){dismissControlCoach();return;}
 heldControlCoach=null;
 suppressedCoachClick={button:press.button,until:Date.now()+650};
}
document.addEventListener('pointerup',finishHeldCoach,true);
document.addEventListener('pointercancel',finishHeldCoach,true);
document.addEventListener('contextmenu',event=>{
 if(heldControlCoach?.button!==event.target.closest?.('button[data-action]')||!heldControlCoach)return;
 event.preventDefault();event.stopImmediatePropagation();
 revealHeldCoach();
},true);
document.addEventListener('click',event=>{
 if(!suppressedCoachClick)return;
 const {button,until}=suppressedCoachClick;
 suppressedCoachClick=null;
 if(event.detail===0||Date.now()>until||event.target.closest?.('button[data-action]')!==button)return;
 event.preventDefault();event.stopImmediatePropagation();
},true);
document.addEventListener('focusin',event=>{
 if(controlCoachKeyboard||event.target.matches?.(':focus-visible'))scheduleControlCoach(event.target.closest?.('button[data-action]'));
});
document.addEventListener('focusout',event=>{if(event.target===controlCoachTarget)dismissControlCoach();});
document.addEventListener('keydown',()=>{controlCoachKeyboard=true;dismissControlCoach();},true);
document.addEventListener('scroll',event=>{
 if(event.target===document||event.target.contains?.(controlCoachTarget))dismissControlCoach();
},true);
document.addEventListener('visibilitychange',dismissControlCoach);
document.addEventListener('fullscreenchange',dismissControlCoach);
window.addEventListener?.('resize',dismissControlCoach);
