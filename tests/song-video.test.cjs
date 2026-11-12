const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createApp}=require('./app-harness.cjs');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const run=(h,code)=>vm.runInContext(code,h.ctx);
function media(node,{width=1920,height=1080,duration=725}={}){
 Object.assign(node,{tagName:'VIDEO',videoWidth:width,videoHeight:height,duration,currentTime:0,paused:true,seeking:false,ended:false});
 node.emit=(name,event={})=>{for(const f of [...node.listeners[name]||[]])f({target:node,...event});};
 node.pause=()=>{node.paused=true;node.emit('pause');};
 node.play=async()=>{node.paused=false;node.emit('play');};
 node.load=()=>{};
 let src='';
 Object.defineProperty(node,'src',{get:()=>src,set:value=>{src=value;if(value)node.emit('loadedmetadata');}});
 node.removeAttribute=()=>{src='';};
 return node;
}
function useIO(h){
 Object.assign(h.ctx,{TextEncoder,TextDecoder,Uint32Array,DataView,Response,DecompressionStream});
 Object.assign(h.ctx.PAYLOAD,{guide:'Guide',entry:'Entry',schema:{},validator:'Validator',readme:'Readme'});
 const source=fs.readFileSync(path.join(__dirname,'../src/io.js'),'utf8').split('let draftDB;')[0];
 run(h,source+'\nconst originalMakeZip=makeZip;makeZip=async files=>{globalThis.savedFiles=files;return originalMakeZip(files);};download=blob=>{globalThis.savedZip=blob;};');
}
(async()=>{
 const h=createApp();useIO(h);
 const player=media(h.$('#songVideoPlayer'));
 h.document.createElement=tag=>{assert.equal(tag,'video');return media(new h.Node());};
 h.api.seek(6);await h.api.action('mode-song-video');
 assert(h.$('#workspace').classList.contains('song-video-mode'));
 assert(h.$('#songVideoStatus').textContent.includes('还没有'));
 const bytes=new Uint8Array(4*1024*1024+9);bytes[0]=7;bytes[bytes.length-1]=93;
 h.ctx.sourceFile=new File([bytes],'full-rehearsal.mp4',{type:'video/mp4'});
 await run(h,'importSongVideo(sourceFile,{s:show(),q:song()})');await flush();
 const q=h.api.state().lib.shows[0].songs[0],record=q.rehearsalVideo,key='shows/s/songs/q/'+record.file;
 assert.equal(record.duration,725,'A full-song video longer than ten minutes is accepted');
 assert.equal(record.width,1920);assert.equal(record.height,1080);
 assert.equal(await run(h,'resourceFile('+JSON.stringify(key)+')'),h.ctx.sourceFile,'1080p media stays byte-identical');
 assert.equal(h.C.checkStructure(h.api.state().lib),h.api.state().lib);
 assert.deepEqual({...run(h,'fitMediaDimensions(3840,2160,1920,1080)')},{width:1920,height:1080});
 assert.deepEqual({...run(h,'fitMediaDimensions(2160,3840,1920,1080)')},{width:1080,height:1920});
 const invalid=h.C.clone(h.api.state().lib);invalid.shows[0].songs[0].rehearsalVideo.file='../outside.mp4';assert.throws(()=>h.C.checkStructure(invalid));
 await assert.rejects(run(h,'compressStepVideo(sourceFile,{cancelHooks:new Set(),check(){}})'),/2 分钟/,'Step-note duration rules still apply');
 const seek=at=>{const input=h.$('#songVideoSeek');input.value=String(at);input.listeners.input[0]({target:input});};
 seek(2.5);await h.api.action('song-video-mark-start');
 seek(4.75);await h.api.action('song-video-mark-end');
 assert.equal(player.currentTime,2.5);
 await h.api.action('song-video-play');assert.equal(player.paused,false);
 player.currentTime=4.74;player.emit('timeupdate');assert.equal(player.paused,false);
 player.currentTime=4.75;player.emit('timeupdate');assert.equal(player.paused,true);assert.equal(player.currentTime,2.5);
 seek(90);assert.equal(player.currentTime,90,'Paused scrubbing can go beyond the practice segment');
 await h.api.action('song-video-play');assert.equal(player.currentTime,2.5);
 await h.api.action('song-video-loop');player.currentTime=5;player.emit('timeupdate');assert.equal(player.paused,false);
 await h.api.action('song-video-fullscreen');assert(h.$('#songVideoScreen').classList.contains('video-viewport'));
 await h.api.action('song-video-fullscreen');assert(!h.$('#songVideoScreen').classList.contains('video-viewport'));
 await h.api.action('song-video-exit');assert(player.paused);assert.equal(h.api.state().current,6,'The video never drives the stage clock');
 await run(h,'exportPackage(lib.shows)');
 const saved=await run(h,'readZip(savedZip)'),parsed=await (h.ctx.savedMap=saved,run(h,'parsePackage(savedMap)'));
 assert.deepEqual(parsed.library.shows[0].songs[0].rehearsalVideo,record);
 const result=Buffer.from(await saved.get(key).arrayBuffer());assert(result.equals(Buffer.from(bytes)));
 const entry=h.ctx.savedFiles.get('走台本.html');
 const index=JSON.parse(entry.match(/<script id="embedded-asset-index"[^>]*>([\s\S]*?)<\/script>/)[1]);
 assert.equal(index[key].parts.length,2);assert(entry.length<2000000);
 const fresh=createApp();
 fresh.$('#embedded-asset-index').textContent=JSON.stringify(index);
 fresh.document.createElement=()=>({remove(){}});
 fresh.document.head={append(script){
  const part=decodeURI(new URL(script.src).pathname).replace('/offline/','');
  h.ctx.savedFiles.get('演出资料/'+part).text().then(source=>{run(fresh,source);script.onload();});
 }};
 const linked=await run(fresh,'resourceFile('+JSON.stringify(key)+')');
 assert(Buffer.from(await linked.arrayBuffer()).equals(Buffer.from(bytes)),'Reopening a linked package assembles the original video bytes in order');
 const importedVideoKey='shows/s/songs/q/assets/imported-rehearsal.m4v';
 h.ctx.importedVideoKey=importedVideoKey;
 const importedEntry=await run(h,`(async()=>{
  const importedSong={...song(),rehearsalVideo:{...song().rehearsalVideo,file:'assets/imported-rehearsal.m4v'}};
  const files=new Map([['index.html','<html><head></head><body></body></html>'],[importedVideoKey,new Blob(['recording'])]]);
  await embedPackageAudio(files,files,songMediaReferences(show(),importedSong));
  return files.get('index.html');
 })()`);
 const importedIndex=JSON.parse(importedEntry.match(/<script id="embedded-asset-index"[^>]*>([\s\S]*?)<\/script>/)[1]);
 assert.equal(importedIndex[importedVideoKey].mimeType,'video/mp4','Repackaging an imported M4V uses its declared MIME');
 const version=await run(h,"captureVersion(show(),'Video reference')");
 const versionKey='shows/s/songs/q/'+version.version.snapshot.songs[0].rehearsalVideo.file;
 assert.notEqual(versionKey,key);assert.equal(version.assets.get(versionKey),h.ctx.sourceFile);
 const audioTrack={kind:'audio',stop(){}},videoTrack={kind:'video',stop(){}};
 const stream={tracks:[videoTrack],addTrack(track){this.tracks.push(track);},getTracks(){return this.tracks;}};
 let canvas,encodedOptions,encoder,sourceVideo,plays=0;
 h.document.createElement=tag=>{
  if(tag==='canvas'){canvas={getContext:()=>({drawImage(){}}),captureStream:()=>stream};return canvas;}
  const input=media(new h.Node(),{width:3840,height:2160,duration:3});
  sourceVideo=input;
  input.play=async()=>{plays++;input.paused=false;input.currentTime=plays===1?1:3;input.ended=plays>1;};
  return input;
 };
 h.ctx.window.AudioContext=class{
  state='running';
  async resume(){}
  async close(){}
  createMediaElementSource(){return{connect(){}};}
  createMediaStreamDestination(){return{stream:{getAudioTracks:()=>[audioTrack]}};}
 };
 h.ctx.MediaRecorder=class{
  static isTypeSupported(type){return type==='video/mp4';}
  state='inactive';
  constructor(input,options){assert.equal(input,stream);encoder=this;encodedOptions=options;this.mimeType=options.mimeType;}
  start(){this.state='recording';}
  pause(){this.state='paused';}
  resume(){this.state='recording';}
  stop(){this.state='inactive';this.ondataavailable({data:new Blob(['downscaled'])});this.onstop();}
 };
 const converting=run(h,'prepareVideo(sourceFile,{check(){},report(){},cancelHooks:new Set()},{songMime:"video/mp4"})');
 await flush();
 h.document.hidden=true;
 for(const listener of h.document.listeners.visibilitychange)await listener();
 assert.equal(encoder.state,'paused');assert(sourceVideo.paused,'Hidden conversion stops its source clock');
 h.document.hidden=false;
 for(const listener of h.document.listeners.visibilitychange)await listener();
 const resized=await converting;
 assert.equal(canvas.width,1920);assert.equal(canvas.height,1080);
 assert.equal(resized.mimeType,'video/mp4');assert.equal(await resized.blob.text(),'downscaled');
 assert(stream.tracks.includes(audioTrack));assert.equal(encodedOptions.videoBitsPerSecond,5000000);
 const deleting=h.api.action('song-video-remove');await flush();h.$('#confirmContinue').onclick();await deleting;
 assert.equal(q.rehearsalVideo,undefined);h.api.undo();
 assert.equal(await run(h,'resourceFile('+JSON.stringify(key)+')'),h.ctx.sourceFile,'Undo restores the removed video bytes');
 console.log('PASS: full-song import beyond ten minutes, original 1080p bytes, resize bounds, separate transport, pause-and-return practice, fullscreen fallback, chunked ZIP/reopen and version capture');
})().catch(error=>{console.error(error);process.exitCode=1;});
