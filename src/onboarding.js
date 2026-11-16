/* Help locates the existing controls. It never applies a change to a production. */
const featureCommands=[
 {id:'import',title:'导入走台',words:'打开演出包 ZIP 文件夹',target:'.topbar [data-action="open"]',menu:'.app-menu',action:'open'},
 {id:'block',title:'编排',words:'演员位置 设定站位 移动 路线',target:'#editMode',action:'mode-edit'},
 {id:'timeline',title:'时间轴',words:'进度条 拖动 进度 定位 播放指针',path:'编排',mode:'edit',target:'#timelineTab',action:'bottom-timeline'},
 {id:'zoom',title:'时间轴缩放',words:'放大时间轴 缩小时间轴 横向 双指 捏合',path:'时间轴',mode:'edit',panel:'timeline',target:'#timelineZoom'},
 {id:'step',title:'＋ 添加动作',words:'新步骤 添加步骤 新建 走位',path:'编排',mode:'edit',target:'#addStepButton'},
 {id:'delete',title:'删除本步',words:'删除步骤 移除动作 Delete',path:'编排',mode:'edit',target:'#deleteStepButton'},
 {id:'stage',title:'全屏舞台',words:'大屏 舞台 放大',path:'编排',mode:'edit',target:'#stageFullscreenButton'},
 {id:'walk',title:'走位排练',words:'走位排练 演员 动作 倒计时 我的角色',target:'#rehearseMode',action:'mode-rehearse'},
 {id:'role',title:'我的角色',words:'选演员 演员倒计时 下一次移动',path:'走位排练',mode:'rehearse',target:'#stageRehearsalRoleField',fallback:'#rehearseMode'},
 {id:'sing',title:'练歌',words:'歌词 练声 唱歌 声部',target:'#singMode',action:'mode-sing'},
 {id:'harmony',title:'和声练习',words:'声部 谱 唱段 音符 钢琴 试听',path:'练歌',mode:'sing',target:'#singVocalMode',fallback:'#singMode'},
 {id:'repeat',title:'循环练习',words:'重复 循环 歌词 指定片段',path:'练歌',mode:'sing',target:'[data-action="sing-passage"]'},
 {id:'video',title:'排练视频',words:'录像 视频 回看 复盘',target:'#songVideoMode',action:'mode-song-video'},
 {id:'alignment',title:'检查站位对齐',words:'纠正走位 整理站位 横排 竖排 中心线 等距',path:'编排',mode:'edit',target:'.alignment-launch button',menu:'.stage-tools',action:'alignment-check'},
 {id:'video-add',title:'添加视频',words:'导入录像 上传视频 视频文件',path:'排练视频',mode:'song-video',target:'#songVideoAdd'},
 {id:'light',title:'灯光提示',words:'控灯 提词 提醒 灯光 倒数 洋葱皮 涂鸦',target:'#reminderMode',action:'mode-reminder'},
 {id:'light-add',title:'添加提醒',words:'新增灯光提示 倒计时 跟随歌词 Cue',path:'灯光提示',mode:'reminder',target:'#reminderEdit',action:'reminder-add'},
 {id:'audio',title:'连接音乐',words:'无声 配乐 BGM 导入音频 MP3',path:'编排',mode:'edit',target:'#audioButton'},
 {id:'lyrics',title:'导入歌词',words:'字幕 逐句 时间戳 LRC',path:'编排',mode:'edit',target:'#lyricsDock [data-action="lyrics"]',menu:'.lyrics-tools',fallback:'#lyricsToggle',action:'lyrics'},
 {id:'save',title:'保存',words:'备份 下载 ZIP 导出演出',target:'.topbar [data-action="save"]'},
 {id:'share',title:'发给演员',words:'分享 交接 演出包 导出',target:'.topbar [data-action="export"]',menu:'.app-menu',action:'export'},
 {id:'find-data',title:'搜索演出内容',words:'找角色 歌名 曲目 笔记 记录',action:'search',target:'#findProduction',menu:'.app-menu'},
 {id:'tutorial',title:'新手教程',words:'帮助 入门 指南 学习',action:'tutorial-start',target:'#modeGuideButton'},
 {id:'transport-loop',title:'局部循环',words:'A B 精确循环 循环片段 标记区间',path:'时间轴',mode:'edit',panel:'timeline',target:'#transportLoopMarks',fallback:'#loopButton'},
 {id:'preferences',title:'操作偏好',words:'设置 个性化 快捷键 焦点 恢复 循环',target:'.app-menu [data-action="operation-preferences"]',menu:'.app-menu',action:'operation-preferences'},
 {id:'shortcuts',title:'快捷键与右键菜单',words:'键盘 热键 快捷 右键',target:'.shortcuts-button',fallback:'#modeGuideButton',action:'edit-shortcuts'}
];
function featureSearchKey(value){
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').normalize('NFC').toLowerCase().replace(/[＋+，。？！、¿?¡!]/g,' ').trim();
}
function featureMatches(query){
 const text=featureSearchKey(query).replace(/^(?:我想|我该|请问)?(?:应该)?(?:要?怎么|如何|在哪里|在哪|どうやって|どこで|どこに|como |how (?:do i |to )?)/u,'').replace(/(?:在哪里|在哪儿?|怎么弄|怎么办|するには|はどこ(?:ですか)?)$/u,'').trim();
 if(!text)return featureCommands.filter(({id})=>['import','timeline','walk','sing','light','tutorial'].includes(id));
 const tokens=text.split(/\s+/).filter(word=>!['a','an','the','de','del','el','la','los','las'].includes(word));
 if(!tokens.length)return [];
 return featureCommands.map(command=>{
  const title=featureSearchKey(tr(command.title)), keywords=featureSearchKey([command.title,tr(command.words),command.words,tr(command.path||'')].join(' '));
  const score=title===text?4:title.startsWith(text)?3:title.includes(text)?2:tokens.every(token=>keywords.includes(token)||title.includes(token))?1:0;
  return {command,score};
 }).filter(result=>result.score).sort((a,b)=>b.score-a.score).map(result=>result.command);
}

let helpTarget=null,helpTargetTimer,featureMatchesShown=[],featureIndex=-1,tutorialIndex=-1;
function visibleHelpControl(...selectors){
 return selectors.filter(Boolean).flatMap(selector=>$$(selector)).find(node=>{
  if(!node.getClientRects().length||node.checkVisibility?.({checkVisibilityCSS:true,contentVisibilityAuto:true})===false)return false;
  for(let parent=node.parentElement;parent;parent=parent.parentElement){
   if(parent===node)break;
   if(parent.matches('details:not([open])')&&node.closest('summary')?.parentElement!==parent)return false;
  }
  return true;
 });
}
const workspaceMenuSelector='details:is(.app-menu,.stage-tools,[data-ui-menu])';
function openWorkspaceMenus(){return $$(workspaceMenuSelector+'[open]');}
function dismissMenuPointer(menu){if(helpTarget&&menu.contains(helpTarget))pointAtHelp(null);}
function closeWorkspaceMenus(inside=null){
 for(const menu of openWorkspaceMenus())if(!inside||!menu.contains(inside)){
  menu.open=false;
  dismissMenuPointer(menu);
 }
}
document.addEventListener('pointerdown',event=>closeWorkspaceMenus(event.target),true);
document.addEventListener('toggle',event=>{
 const menu=event.target;if(menu.matches?.(workspaceMenuSelector)&&!menu.open)dismissMenuPointer(menu);
},true);
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||$('#dialog').open||$('#featureFinder').open||stageFullscreenMode||contextMenuOpen())return;
 const latest=openWorkspaceMenus().at(-1);if(!latest)return;
 event.preventDefault();event.stopPropagation();
 closeWorkspaceMenus();latest.querySelector('summary')?.focus({preventScroll:true});
},true);
function positionHelpPointer(){
 const pointer=$('#helpPointer'),rect=helpTarget?.isConnected&&helpTarget.getBoundingClientRect();
 if(!rect||!rect.width||!rect.height||rect.bottom<0||rect.top>window.innerHeight){pointer.hidden=true;return;}
 const left=Math.max(2,rect.left-4),right=Math.min(window.innerWidth-2,rect.right+4);
 const top=Math.max(2,rect.top-4),bottom=Math.min(window.innerHeight-2,rect.bottom+4);
 if(right<=left||bottom<=top){pointer.hidden=true;return;}
 pointer.hidden=false;
 pointer.dataset.arrow=top<29?'below':'above';
 pointer.style.cssText='left:'+left+'px;top:'+top+'px;width:'+(right-left)+'px;height:'+(bottom-top)+'px';
}
function pointAtHelp(control,{reveal=false,temporary=false}={}){
 clearTimeout(helpTargetTimer);helpTarget=control||null;
 if(reveal)control?.scrollIntoView({block:'nearest',inline:'nearest'});
 positionHelpPointer();
 if(temporary&&control)helpTargetTimer=setTimeout(()=>pointAtHelp(null),6000);
}

function featureFinderOpen(){
 const panel=$('#featureFinder');
 if(panel.open){$('#featureQuery').focus();return;}
 if(tutorialIndex>=0&&tutorialSteps[tutorialIndex]?.id!=='search')closeTutorial(false);
 $('#featureQuery').value='';panel.show();recordTutorialPractice('search');
 if(tutorialIndex>=0)positionTutorial();
 $('#featureFindButton').setAttribute('aria-expanded','true');
 renderFeatureResults();
 $('#featureQuery').focus();
}
function closeFeatureFinder(restoreFocus=false){
 const panel=$('#featureFinder');if(!panel.open)return;
 panel.close();$('#featureFindButton').setAttribute('aria-expanded','false');pointAtHelp(null);queueTutorialLayout();
 if(restoreFocus&&tutorialIndex>=0){positionTutorial();$('#tutorialNext').focus({preventScroll:true});}
 else if(restoreFocus)visibleHelpControl('#featureFindButton','#modeGuideButton')?.focus();
}
function renderFeatureResults(){
 const input=$('#featureQuery');
 $('#featureFinderTitle').textContent=tr('查找功能');
 input.placeholder=tr('例如：时间轴缩放、导入歌词');
 input.setAttribute('aria-label',tr('查找功能'));
 $('#featureClose').setAttribute('aria-label',tr('关闭'));
 featureMatchesShown=featureMatches(input.value);
 $('#featureResults').innerHTML=featureMatchesShown.map(({id,title,path,action:command})=>
  '<li><button class="feature-result" data-find-open="'+id+'"><strong>'+esc(tr(title))+'</strong><small>'+esc(tr(path||'工作区'))+'</small></button>'+
  (command?'<button class="feature-locate" data-find-locate="'+id+'" aria-label="'+esc(ui`定位功能：${tr(title)}`)+'">'+esc(tr('看位置'))+'</button>':'')+'</li>'
 ).join('');
 $('#featureEmpty').textContent=featureMatchesShown.length?'':tr('没找到功能。试试更短的词，例如「时间轴」。');
 featureIndex=-1;
 if(featureMatchesShown.length)setFeatureResult(0,false);else pointAtHelp(null);
}
function setFeatureResult(index,scroll){
 const item=featureMatchesShown[index];if(!item)return;
 featureIndex=index;
 for(const button of $$('#featureResults .feature-result'))button.classList.toggle('selected',button.dataset.findOpen===item.id);
 if(scroll)$('#featureResults [data-find-open="'+item.id+'"]')?.scrollIntoView({block:'nearest'});
 pointAtHelp(visibleHelpControl(item.target,item.fallback));
}
async function selectFeature(id,locate=false){
 const command=featureCommands.find(item=>item.id===id);if(!command)return;
 closeFeatureFinder();
 if(command.mode){
  const active=$('[data-action="mode-'+command.mode+'"]')?.getAttribute('aria-pressed')==='true';
  if(!active)await action('mode-'+command.mode);
 }
 if(command.panel&&bottomTab!==command.panel)await action('bottom-'+command.panel);
 if(!locate&&command.action){await action(command.action);return;}
 if(command.menu&&!visibleHelpControl(command.target)){const menu=$(command.menu);if(menu)menu.open=true;}
 const target=visibleHelpControl(command.target,command.fallback);
 if(target){target.focus({preventScroll:true});pointAtHelp(target,{reveal:true,temporary:true});}
}
$('#featureQuery').addEventListener('input',renderFeatureResults);
$('#featureResults').addEventListener('pointerover',event=>{
 if(event.pointerType==='touch')return;
 const button=event.target.closest('[data-find-open],[data-find-locate]');
 if(button)setFeatureResult(featureMatchesShown.findIndex(item=>item.id===(button.dataset.findOpen||button.dataset.findLocate)),false);
});
$('#featureResults').addEventListener('focusin',event=>{
 const id=event.target.dataset.findOpen||event.target.dataset.findLocate;
 if(id)setFeatureResult(featureMatchesShown.findIndex(item=>item.id===id),false);
});
$('#featureFinder').addEventListener('click',event=>{
 const button=event.target.closest('[data-find-open],[data-find-locate]');
 if(button)void selectFeature(button.dataset.findOpen||button.dataset.findLocate,!!button.dataset.findLocate);
});
$('#featureClose').addEventListener('click',()=>closeFeatureFinder(true));

const tutorialSteps=[
 {id:'files',title:'先认识「更多」菜单',text:'点高亮的「⋯」，就能找到导入走台、语言和设置。可以用当前演出继续练习。',done:'已经找到导入入口。',target:'.app-menu > summary'},
 {id:'stage',title:'在舞台上选演员',text:'点一个演员圆点，看看所选角色和他的动作如何显示。',empty:'当前没有可选的演员。舞台上的圆点会显示每个人的站位。',mode:'edit',target:'#stage [data-entity]',fallback:'#stageWrap'},
 {id:'timeline',title:'在时间轴上定位',text:'点时间刻度或拖播放指针，看看舞台上的站位如何跟着变。',fallbackText:'点播放时间，输入一个时间，看看演员的位置怎样变化。',mode:'edit',panel:'timeline',target:'#bottomContent .ruler',fallback:'#currentTime'},
 {id:'role',title:'排练时选自己的角色',text:'打开「我的角色」选一个人，就能看他的下一次移动和备注。',empty:'本曲目还没有参演角色。有演员的曲目会在舞台上方显示「我的角色」。',mode:'rehearse',target:'#stageRehearsalRole',fallback:'#rehearseMode'},
 {id:'search',title:'忘记入口时，查找功能',text:'点放大镜，试输「时间轴」或你想做的事。关闭查找后就能回来完成教程。',done:'已打开功能查找。',target:'#featureFindButton'}
];
const tutorialCompleted=new Set();
let tutorialLayoutFrame=0,tutorialMotionFrame=0,tutorialGeneration=0;
function tutorialPaused(){
 return $('#dialog').open||$('#featureFinder').open||stageFullscreenMode||singingPresentation.active()||songVideoPresentation.active()||reminderPresentation.active();
}
function tutorialTarget(step){
 if(step.id==='files'&&$('.app-menu')?.open)
  return visibleHelpControl('.app-menu [data-action="open"]',step.target);
 if(step.mode&&$('[data-action="mode-'+step.mode+'"]')?.getAttribute('aria-pressed')!=='true')
  return visibleHelpControl(step.mode==='edit'?'#editMode':'#rehearseMode');
 return visibleHelpControl(step.target,step.fallback,step.id==='stage'?'#editMode':null);
}
function tutorialTargetBounds(node){
 if(!node)return null;
 const {left,right,top,bottom}=node.getBoundingClientRect();
 const clip={left:Math.max(4,left),right:Math.min(window.innerWidth-4,right),top:Math.max(4,top),bottom:Math.min(window.innerHeight-4,bottom)};
 const scrolls=/^(auto|scroll|hidden|clip)$/;
 for(let parent=node.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
  if(parent===node)break;
  const style=getComputedStyle(parent);
  if(!scrolls.test(style.overflowX)&&!scrolls.test(style.overflowY))continue;
  const bounds=parent.getBoundingClientRect();
  if(scrolls.test(style.overflowX)){clip.left=Math.max(clip.left,bounds.left);clip.right=Math.min(clip.right,bounds.right);}
  if(scrolls.test(style.overflowY)){clip.top=Math.max(clip.top,bounds.top);clip.bottom=Math.min(clip.bottom,bounds.bottom);}
 }
 return clip.right>clip.left&&clip.bottom>clip.top?clip:null;
}
function positionTutorial(){
 const card=$('#tutorialCard'),spotlight=$('#tutorialSpotlight'),beacon=$('#tutorialBeacon');
 const step=tutorialSteps[tutorialIndex];
 card.hidden=!step||tutorialPaused();
 if(card.hidden){spotlight.hidden=beacon.hidden=true;return;}
 const viewportWidth=window.innerWidth,viewportHeight=window.innerHeight;
 const padding=12,gap=18;
 const target=tutorialTarget(step),targetBounds=tutorialTargetBounds(target);
 const anchor=targetBounds||tutorialTargetBounds(visibleHelpControl(step.fallback));
 if(step.fallbackText)$('#tutorialText').textContent=tr(targetBounds&&target?.id!=='currentTime'?step.text:step.fallbackText);
 const {width,height}=card.getBoundingClientRect();
 const fitX=x=>Math.max(padding,Math.min(x,viewportWidth-padding-width));
 const fitY=y=>Math.max(padding,Math.min(y,viewportHeight-padding-height));
 let left=fitX(viewportWidth-width-padding),top=fitY(viewportHeight-height-padding),side='above';
 if(anchor){
  const cx=(anchor.left+anchor.right)/2,cy=(anchor.top+anchor.bottom)/2;
  const placements=[
   {side:'right',room:viewportWidth-anchor.right-width,left:anchor.right+gap,top:fitY(cy-height/2)},
   {side:'left',room:anchor.left-width,left:anchor.left-width-gap,top:fitY(cy-height/2)},
   {side:'below',room:viewportHeight-anchor.bottom-height,left:fitX(cx-width/2),top:anchor.bottom+gap},
   {side:'above',room:anchor.top-height,left:fitX(cx-width/2),top:anchor.top-height-gap}
  ];
  const placement=placements.find(item=>item.room>=gap+padding);
  if(placement)({left,top,side}=placement);
  else{
   side=cy<viewportHeight/2?'below':'above';
   top=fitY(side==='above'?padding:viewportHeight-padding-height);
  }
  spotlight.hidden=false;
  spotlight.style.cssText='left:'+(anchor.left-3)+'px;top:'+(anchor.top-3)+'px;width:'+(anchor.right-anchor.left+6)+'px;height:'+(anchor.bottom-anchor.top+6)+'px';
  const marker={above:[cx,anchor.top-9],below:[cx,anchor.bottom+9],left:[anchor.left-9,cy],right:[anchor.right+9,cy]}[side];
  beacon.hidden=marker[0]<8||marker[0]>viewportWidth-8||marker[1]<8||marker[1]>viewportHeight-8;
  beacon.dataset.side=side;
  beacon.style.cssText='left:'+marker[0]+'px;top:'+marker[1]+'px';
 }else spotlight.hidden=beacon.hidden=true;
 card.style.left=left+'px';card.style.top=top+'px';
}
function queueTutorialLayout(){
 if(tutorialIndex<0||tutorialLayoutFrame)return;
 tutorialLayoutFrame=requestAnimationFrame(()=>{tutorialLayoutFrame=0;positionTutorial();});
}
function renderTutorialCopy(){
 const step=tutorialSteps[tutorialIndex];if(!step)return;
 const done=tutorialCompleted.has(step.id),feedback=$('#tutorialFeedback');
 const empty=step.empty&&(step.id==='stage'?!activeEntities().length:!song().castIds.length);
 $('#tutorialCount').textContent=ui`第 ${tutorialIndex+1} 步，共 ${tutorialSteps.length} 步`;
 $('#tutorialCard').style.setProperty('--tutorial-progress',((tutorialIndex+1)/tutorialSteps.length*100)+'%');
 $('#tutorialTitle').textContent=tr(step.title);
 $('#tutorialText').textContent=tr(empty?step.empty:step.text);
 $('#tutorialDismiss').setAttribute('aria-label',tr('退出教程'));
 $('#tutorialBack').textContent=tr('上一步');
 $('#tutorialBack').disabled=tutorialIndex===0;
 $('#tutorialNext').textContent=tr(tutorialIndex===tutorialSteps.length-1?'完成教程':'下一步');
 feedback.hidden=!done;
 feedback.textContent=done?tr(step.done||'这一步完成了。'):'';
 if(done)feedback.setAttribute('data-complete','');
 else feedback.removeAttribute('data-complete');
}
function recordTutorialPractice(id){
 if(tutorialSteps[tutorialIndex]?.id!==id||tutorialCompleted.has(id))return;
 tutorialCompleted.add(id);
 renderTutorialCopy();queueTutorialLayout();
}
function animateTutorialStep(){
 const nodes=[$('#tutorialCard'),$('#tutorialSpotlight'),$('#tutorialBeacon')];
 nodes.forEach(node=>node.removeAttribute('data-enter'));
 // Commit the old animation state before starting the next step's animation.
 nodes[0].getBoundingClientRect();
 cancelAnimationFrame(tutorialMotionFrame);
 tutorialMotionFrame=requestAnimationFrame(()=>{if(tutorialIndex>=0)nodes.forEach(node=>node.setAttribute('data-enter',''));});
}
async function showTutorialStep(index){
 if(index<0)return;
 if(index>=tutorialSteps.length){closeTutorial();toast(tr('新手教程已完成。'));return;}
 const version=++tutorialGeneration,step=tutorialSteps[index];
 tutorialIndex=index;
 closeWorkspaceMenus();pointAtHelp(null);
 if(step.mode&&$('[data-action="mode-'+step.mode+'"]')?.getAttribute('aria-pressed')!=='true')await action('mode-'+step.mode);
 if(version!==tutorialGeneration)return;
 if(step.panel&&bottomTab!==step.panel)await action('bottom-'+step.panel);
 if(version!==tutorialGeneration)return;
 renderTutorialCopy();
 tutorialTarget(step)?.scrollIntoView({block:'nearest',inline:'nearest'});
 positionTutorial();animateTutorialStep();queueTutorialLayout();
}
async function startTutorial(){
 tutorialCompleted.clear();
 if($('#featureFinder').open)closeFeatureFinder();
 if($('#dialog').open)closeModal();
 await showTutorialStep(0);
 if(tutorialIndex===0)$('#tutorialNext').focus({preventScroll:true});
}
function closeTutorial(restoreFocus=true){
 tutorialGeneration++;tutorialIndex=-1;
 cancelAnimationFrame(tutorialLayoutFrame);cancelAnimationFrame(tutorialMotionFrame);tutorialLayoutFrame=0;
 for(const id of ['#tutorialCard','#tutorialSpotlight','#tutorialBeacon'])$(id).hidden=true;
 if(restoreFocus)visibleHelpControl('#modeGuideButton')?.focus({preventScroll:true});
}
function refreshOnboardingLanguage(){
 if($('#featureFinder').open)renderFeatureResults();
 if(tutorialIndex>=0){renderTutorialCopy();queueTutorialLayout();}
}
$('#tutorialDismiss').addEventListener('click',()=>closeTutorial());
$('#tutorialBack').addEventListener('click',()=>void showTutorialStep(tutorialIndex-1));
$('#tutorialNext').addEventListener('click',()=>void showTutorialStep(tutorialIndex+1));
document.addEventListener('toggle',event=>{
 if(event.target.matches?.('.app-menu[open]'))recordTutorialPractice('files');
 queueTutorialLayout();
},true);
document.addEventListener('pointerdown',event=>{
 const target=event.target;
 if(target.closest?.('#stage [data-entity]'))recordTutorialPractice('stage');
 if(target.closest?.('#bottomContent [data-seek],#bottomContent [data-scrub-handle]'))recordTutorialPractice('timeline');
},true);
document.addEventListener('change',event=>{
 if(event.target.id==='stageRehearsalRole')recordTutorialPractice('role');
 queueTutorialLayout();
},true);
document.addEventListener('submit',event=>{
 if(event.target.id==='seekForm')recordTutorialPractice('timeline');
},true);
document.addEventListener('keydown',event=>{
 if(event.target.closest?.('#bottomContent [data-scrub-handle]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key))recordTutorialPractice('timeline');
 if(event.target.closest?.('#stage [data-entity]')&&event.key==='Enter')recordTutorialPractice('stage');
},true);
for(const event of ['click','pointerup','fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,queueTutorialLayout,true);
$('#dialog').addEventListener('close',queueTutorialLayout);
document.addEventListener('pointerdown',event=>{
 if($('#featureFinder').open&&!event.target.closest('#featureFinder,[data-action="feature-find"]'))closeFeatureFinder();
},true);
document.addEventListener('keydown',event=>{
 if(event.isComposing||event.defaultPrevented)return;
 if((event.metaKey||event.ctrlKey)&&event.shiftKey&&event.key.toLowerCase()==='k'&&!$('#dialog').open&&!stageFullscreenMode&&!singingPresentation.active()&&!songVideoPresentation.active()&&!reminderPresentation.active()&&!videoExporting&&!stepMediaBusy){
  event.preventDefault();event.stopPropagation();featureFinderOpen();return;
 }
 if($('#featureFinder').open){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeFeatureFinder(true);return;}
  if(event.target!==$('#featureQuery'))return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();event.stopPropagation();
   setFeatureResult(Math.min(featureMatchesShown.length-1,Math.max(0,featureIndex+(event.key==='ArrowDown'?1:-1))),true);
  }else if(event.key==='Enter'&&featureIndex>=0){
   event.preventDefault();event.stopPropagation();
   void selectFeature(featureMatchesShown[featureIndex].id,event.altKey);
  }
 }else if(tutorialIndex>=0&&event.key==='Escape'&&!tutorialPaused()){
  event.preventDefault();event.stopPropagation();closeTutorial();
 }
},true);
function updateHelpLayout(){positionHelpPointer();queueTutorialLayout();}
window.addEventListener?.('resize',updateHelpLayout);
window.addEventListener?.('scroll',updateHelpLayout,true);
