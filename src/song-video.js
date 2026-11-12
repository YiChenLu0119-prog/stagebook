/* The full-song player has its own transport and never drives the stage clock. */
let songVideoOpen=false,songVideoSource=null,songVideoPick=null,songVideoFrame=0;
const songVideoRanges=new Map();
const songVideoPlayer=$('#songVideoPlayer'),songVideoScreen=$('#songVideoScreen');

function songVideoDuration(){
 const actual=songVideoPlayer.duration;
 return Number.isFinite(actual)&&actual>0?actual:songVideoSource?.record.duration||0;
}
function currentSongVideoRange(){return songVideoRanges.get(songVideoSource?.key);}
function validSongVideoRange(range){
 return Number.isFinite(range?.start)&&Number.isFinite(range?.end)&&range.start>=0&&
  range.end>range.start&&range.end<=songVideoDuration();
}
function updateSongVideoTransport(){
 const duration=songVideoDuration(),current=songVideoPlayer.currentTime||0;
 const seek=$('#songVideoSeek'),play=$('#songVideoPlay');
 seek.max=String(duration);seek.value=String(Math.min(current,duration));seek.setAttribute('aria-valuetext',fmt(current));
 $('#songVideoClock').textContent=fmt(current)+' / '+fmt(duration);
 play.textContent=songVideoPlayer.paused?'▶':'Ⅱ';
 play.setAttribute('aria-label',tr(songVideoPlayer.paused?'播放':'暂停'));
}
function updateSongVideoRange(){
 const range=currentSongVideoRange();
 for(const [edge,selector] of [['start','#songVideoStart'],['end','#songVideoEnd']]){
  const input=$(selector);
  if(input!==document.activeElement)input.value=range?.[edge]!=null?fmt(range[edge],2):'';
 }
 const button=$('#songVideoLoop');
 button.disabled=!songVideoSource?.ready||!validSongVideoRange(range);
 button.setAttribute('aria-pressed',String(!!range?.enabled));
 button.textContent=tr(range?.enabled?'关闭片段循环':'开启片段循环');
 $('#songVideoRangeNote').textContent=range?.enabled?tr('到终点暂停并回到起点'):'';
}
function setSongVideoPoint(edge,value){
 const source=songVideoSource;
 if(!source?.ready)return;
 const duration=songVideoDuration();
 const range={start:null,end:null,enabled:false,...currentSongVideoRange()};
 if(!Number.isFinite(value)||value<0||value>duration){
  toast(tr('请输入视频范围内的时间。'));return;
 }
 if(edge==='end'){
  range.start??=0;
  if(value<=range.start){toast(tr('终点要晚于起点。'));return;}
 }else if(range.end!==null&&value>=range.end){
  range.end=null;
 }
 range[edge]=value;
 range.enabled=validSongVideoRange(range);
 songVideoRanges.set(source.key,range);
 if(range.enabled){
  songVideoPlayer.pause();
  songVideoPlayer.currentTime=range.start;
 }
 updateSongVideoRange();updateSongVideoTransport();
}
function stopSongVideoAtBoundary(ended=false){
 const range=currentSongVideoRange();
 if(!songVideoOpen||!songVideoSource?.ready||!range?.enabled||!validSongVideoRange(range)||
    songVideoPlayer.seeking||!ended&&(songVideoPlayer.paused||songVideoPlayer.currentTime<range.end))return false;
 songVideoPlayer.pause();
 songVideoPlayer.currentTime=range.start;
 updateSongVideoTransport();
 return true;
}
function watchSongVideo(){
 if(!songVideoOpen||songVideoPlayer.paused)return;
 if(stopSongVideoAtBoundary())return;
 updateSongVideoTransport();
 songVideoFrame=requestAnimationFrame(watchSongVideo);
}
async function toggleSongVideo(){
 if(!songVideoSource?.ready)return;
 if(!songVideoPlayer.paused){songVideoPlayer.pause();return;}
 const range=currentSongVideoRange();
 if(range?.enabled&&validSongVideoRange(range)&&
    (songVideoPlayer.currentTime<range.start||songVideoPlayer.currentTime>=range.end))
  songVideoPlayer.currentTime=range.start;
 try{await songVideoPlayer.play();}catch{toast(tr('视频无法开始播放，请重试。'));}
}
function updateSongVideoAvailability(){
 const source=songVideoSource;
 $('#songVideoStatus').textContent=tr(!source?'这首歌还没有排练视频。':source.failed?'视频无法读取，请导入完整演出包或重新选择视频。':source.ready?'':'正在读取视频…');
 for(const control of $$('#songVideoScreen button, #songVideoScreen input'))control.disabled=!source?.ready;
 updateSongVideoRange();updateSongVideoTransport();
}
function releaseSongVideo(){
 if(!songVideoSource)return;
 const source=songVideoSource;
 songVideoSource=null;
 cancelAnimationFrame(songVideoFrame);
 songVideoPlayer.pause();songVideoPlayer.removeAttribute('src');songVideoPlayer.load();
 if(source.url)URL.revokeObjectURL(source.url);
}
async function loadSongVideoBlob(source){
 try{
  const file=await resourceFile(source.key);
  if(songVideoSource!==source)return;
  if(!file)throw Error();
  source.url=URL.createObjectURL(file.type===source.record.mimeType?file:new Blob([file],{type:source.record.mimeType}));
  songVideoPlayer.src=source.url;
 }catch{
  if(songVideoSource!==source)return;
  source.failed=true;updateSongVideoAvailability();
 }
}
function renderSongVideo(){
 const panel=$('#songVideoPanel'),tab=$('#songVideoMode');
 $('#workspace').classList.toggle('song-video-mode',songVideoOpen);
 document.body.classList.toggle('song-video-active',songVideoOpen);
 panel.classList.toggle('hidden',!songVideoOpen);
 tab.classList.toggle('selected',songVideoOpen);tab.setAttribute('aria-pressed',String(songVideoOpen));
 if(!songVideoOpen)return;
 const q=song(),record=q?.rehearsalVideo,picker=$('#songVideoSong');
 const options=show().songs.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.title)+'</option>').join('');
 if(picker.innerHTML!==options)picker.innerHTML=options;
 picker.value=q.id;
 $('#songVideoAdd').textContent=tr(record?'更换视频':'添加视频');
 $('#songVideoRemove').classList.toggle('hidden',!record);
 $('#songVideoFileName').textContent=record?record.name+' · '+record.width+' × '+record.height+' · '+fmt(record.duration):'';
 songVideoScreen.classList.toggle('hidden',!record);
 if(songVideoSource?.record!==record||songVideoSource?.key!==keyPath()+record?.file){
  releaseSongVideo();
  if(record){
   const source={record,key:keyPath()+record.file,ready:false,failed:false,url:null,direct:false};
   songVideoSource=source;
   const direct=packagedSongVideoURL(source.key);
   if(direct){source.direct=true;songVideoPlayer.src=direct;}else loadSongVideoBlob(source);
  }
 }
 updateSongVideoAvailability();updateSongVideoFullscreenButton();
}

function songVideoIsFullscreen(){return (document.fullscreenElement||document.webkitFullscreenElement)===songVideoScreen;}
function updateSongVideoFullscreenButton(){
 const active=songVideoIsFullscreen()||songVideoScreen.classList.contains('video-viewport');
 const button=$('#songVideoFullscreen');
 button.textContent=tr(active?'退出全屏（Esc）':'全屏播放');
 button.setAttribute('aria-pressed',String(active));
}
async function exitSongVideoFullscreen(){
 songVideoScreen.classList.remove('video-viewport');
 if(songVideoIsFullscreen()){
  try{await (document.exitFullscreen||document.webkitExitFullscreen)?.call(document);}catch{}
 }
 updateSongVideoFullscreenButton();
}
async function toggleSongVideoFullscreen(){
 if(songVideoIsFullscreen()||songVideoScreen.classList.contains('video-viewport')){
  await exitSongVideoFullscreen();return;
 }
 try{
  const request=songVideoScreen.requestFullscreen||songVideoScreen.webkitRequestFullscreen;
  if(request){await request.call(songVideoScreen);if(songVideoIsFullscreen())return;}
 }catch{}
 if(songVideoOpen)songVideoScreen.classList.add('video-viewport');
 updateSongVideoFullscreenButton();
}
function openSongVideo(){
 if(songVideoOpen)return;
 if(singing)exitSinging();
 pause();songVideoOpen=true;renderAll();
}
function leaveSongVideo(){
 if(!songVideoOpen)return;
 songVideoOpen=false;void exitSongVideoFullscreen();releaseSongVideo();
}
function handleSongVideoKey(e,typing,cmd){
 if(cmd&&['z','y','o'].includes(e.key.toLowerCase()))return false;
 if(e.key==='Escape'&&!typing){
  if(songVideoIsFullscreen()||songVideoScreen.classList.contains('video-viewport'))void exitSongVideoFullscreen();
  else{leaveSongVideo();renderAll();}
  e.preventDefault();
 }else if(e.code==='Space'&&!typing&&!e.target.closest?.('button,select,input')){
  e.preventDefault();void toggleSongVideo();
 }
 return true;
}

function songVideoFileMime(file){
 const ext=file.name.split('.').pop().toLowerCase();
 const formats={mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',mov:'video/quicktime'};
 if(Object.hasOwn(formats,ext))return formats[ext];
 return Object.hasOwn(C.rehearsalVideoMimes,file.type)?file.type:null;
}
async function importSongVideo(file,target){
 if(!file||!target||stepMediaBusy||videoExporting)return;
 const mime=songVideoFileMime(file);
 if(!mime||!file.size){toast(tr('请选择 MP4、WebM 或 MOV 视频。'));return;}
 const {s,q}=target;
 stepMediaBusy=true;const job=mediaProgress(tr('添加歌曲排练视频'));
 try{
  const result=await prepareVideo(file,job,{songMime:mime});job.check();
  if(!lib.shows.includes(s)||!s.songs.includes(q))return;
  const extension=C.rehearsalVideoMimes[result.mimeType];
  if(!extension)throw Error(tr('视频生成格式不受支持。'));
  const path='assets/'+C.id('rehearsal-video')+'.'+extension;
  mutate(()=>{
   if(q.rehearsalVideo)pendingAssets.delete('shows/'+s.id+'/songs/'+q.id+'/'+q.rehearsalVideo.file);
   q.rehearsalVideo={file:path,name:file.name,mimeType:result.mimeType,width:result.width,
    height:result.height,duration:result.duration,bytes:result.blob.size};
   pendingAssets.set('shows/'+s.id+'/songs/'+q.id+'/'+path,result.blob);
  },false);
  toast(tr('排练视频已添加，保存演出包时会一起带走。'));
 }catch(error){if(error.name!=='AbortError')toast(error.message);}
 finally{job.dispose();closeModal();stepMediaBusy=false;renderAll();}
}
async function songVideoAction(a){
 switch(a){
 case 'song-video-add':
  songVideoPlayer.pause();songVideoPick={s:show(),q:song()};$('#songVideoInput').click();break;
 case 'song-video-remove':{
  const q=song(),record=q.rehearsalVideo;
  if(!record)return;
  const key=keyPath()+record.file;
  songVideoPlayer.pause();
  if(await confirmAction(tr('移除这首歌的排练视频？可以撤销。'))&&q.rehearsalVideo===record){
   mutate(()=>{pendingAssets.delete(key);delete q.rehearsalVideo;});
  }
  break;
 }
 case 'song-video-exit':leaveSongVideo();renderAll();break;
 case 'song-video-play':await toggleSongVideo();break;
 case 'song-video-fullscreen':await toggleSongVideoFullscreen();break;
 case 'song-video-mark-start':setSongVideoPoint('start',songVideoPlayer.currentTime);break;
 case 'song-video-mark-end':setSongVideoPoint('end',songVideoPlayer.currentTime);break;
 case 'song-video-loop':{
  const range=currentSongVideoRange();
  if(validSongVideoRange(range)){range.enabled=!range.enabled;updateSongVideoRange();}
  break;
 }
 }
}
$('#songVideoInput').addEventListener('change',e=>{
 const file=e.target.files?.[0],target=songVideoPick;
 e.target.value='';songVideoPick=null;void importSongVideo(file,target);
});
$('#songVideoSong').addEventListener('change',e=>{if(e.target.value!==songId)void switchSong(e.target.value);});
for(const [edge,selector] of [['start','#songVideoStart'],['end','#songVideoEnd']]){
 $(selector).addEventListener('change',e=>setSongVideoPoint(edge,parsePlaybackTime(e.target.value)));
}
$('#songVideoSeek').addEventListener('pointerdown',()=>songVideoPlayer.pause());
$('#songVideoSeek').addEventListener('input',e=>{
 if(!songVideoSource?.ready)return;
 const at=Number(e.target.value);
 songVideoPlayer.pause();songVideoPlayer.currentTime=at;updateSongVideoTransport();
});
songVideoPlayer.addEventListener('click',()=>void toggleSongVideo());
songVideoPlayer.addEventListener('loadedmetadata',()=>{
 if(!songVideoSource)return;
 songVideoSource.ready=true;songVideoSource.failed=false;updateSongVideoAvailability();
});
songVideoPlayer.addEventListener('error',()=>{
 const source=songVideoSource;if(!source)return;
 source.ready=false;
 if(source.direct){source.direct=false;void loadSongVideoBlob(source);}
 else{source.failed=true;updateSongVideoAvailability();}
});
songVideoPlayer.addEventListener('play',()=>{
 cancelAnimationFrame(songVideoFrame);songVideoFrame=requestAnimationFrame(watchSongVideo);updateSongVideoTransport();
});
songVideoPlayer.addEventListener('pause',()=>{cancelAnimationFrame(songVideoFrame);updateSongVideoTransport();});
songVideoPlayer.addEventListener('timeupdate',()=>{if(!stopSongVideoAtBoundary())updateSongVideoTransport();});
songVideoPlayer.addEventListener('ended',()=>{stopSongVideoAtBoundary(true);updateSongVideoTransport();});
for(const name of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(name,updateSongVideoFullscreenButton);
