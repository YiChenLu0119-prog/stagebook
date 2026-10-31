const assert=require('node:assert/strict'),{createApp}=require('./app-harness.cjs');
function fixture(){
 const h=createApp(),stage=h.$('#stageWrap'),parent=new h.Node('center'),sibling=new h.Node('details'),outside=new h.Node('topbar');
 stage.parent=parent;parent.children=[stage,sibling];parent.parent=h.document.body;h.document.body.children=[parent,outside];sibling.inert=true;outside.inert=false;
 h.$('#stageFullscreenButton').focus();return{...h,stage,outside,sibling};
}
function fire(h,type='fullscreenchange'){for(const fn of h.document.listeners[type]||[])fn({});}
(async()=>{
 let h=fixture();h.api.seek(6.7);await h.api.play();const before=JSON.stringify(h.api.state());
 await h.api.action('stage-fullscreen');assert.equal(h.api.fullscreenMode(),'window');assert(h.stage.classList.contains('stage-fullscreen'));assert(h.outside.inert);assert.equal(h.document.activeElement,h.$('#stageFullscreenExit'));assert(h.$('#stageFullscreenClock').textContent.startsWith('00:06.7'));assert.equal(JSON.stringify(h.api.state()),before);
 const first=new h.Node('actor'),last=h.$('#stageFullscreenExit');h.stage.querySelectorAll=()=>[first,last];h.stage.contains=node=>[first,last].includes(node);let tabbed=false;h.api.handleEditingKey({key:'Tab',target:last,preventDefault:()=>tabbed=true});assert(tabbed);assert.equal(h.document.activeElement,first);
 let escaped=false;h.api.handleEditingKey({key:'Escape',target:h.document.body,preventDefault:()=>escaped=true});await Promise.resolve();assert(escaped);assert.equal(h.api.fullscreenMode(),'');assert(!h.outside.inert);assert(h.sibling.inert,'A pre-existing inert state is preserved');assert.equal(h.document.activeElement,h.$('#stageFullscreenButton'));assert.equal(JSON.stringify(h.api.state()),before);
 h=fixture();h.stage.requestFullscreen=async()=>{h.document.fullscreenElement=h.stage;fire(h);};h.document.exitFullscreen=async()=>{h.document.fullscreenElement=null;fire(h);};await h.api.toggleStageFullscreen();assert.equal(h.api.fullscreenMode(),'native');await h.api.toggleStageFullscreen();assert.equal(h.api.fullscreenMode(),'');
 await h.api.toggleStageFullscreen();h.document.fullscreenElement=null;fire(h);assert.equal(h.api.fullscreenMode(),'','Browser-driven exits restore the workspace');
 h=fixture();h.stage.requestFullscreen=async()=>{throw Error('Fullscreen is not allowed');};await h.api.toggleStageFullscreen();assert.equal(h.api.fullscreenMode(),'window','Denied native fullscreen still fills the window');await h.api.exitStageFullscreen();assert.equal(h.api.fullscreenMode(),'');
 h=fixture();h.stage.webkitRequestFullscreen=()=>{h.document.webkitFullscreenElement=h.stage;fire(h,'webkitfullscreenchange');};h.document.webkitExitFullscreen=()=>{h.document.webkitFullscreenElement=null;fire(h,'webkitfullscreenchange');};await h.api.toggleStageFullscreen();assert.equal(h.api.fullscreenMode(),'native');await h.api.exitStageFullscreen();assert.equal(h.api.fullscreenMode(),'');
 for(const language of ['en','zh-TW']){h.api.setInterfaceLanguage(language);await h.api.toggleStageFullscreen();assert(!/[\u4e00-\u9fff]/.test(h.$('#stageFullscreenButton').textContent)||language==='zh-TW');await h.api.exitStageFullscreen();}
 console.log('PASS: native and WebKit fullscreen, window fallback, denied requests, browser exit and Escape, focus/inert restoration, playback/production/layout context preserved, translated controls');
})().catch(error=>{console.error(error);process.exitCode=1;});
