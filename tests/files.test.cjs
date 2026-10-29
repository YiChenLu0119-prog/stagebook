const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const C=require('../src/core.js'),demo=require('../demo.json');
class Dir{constructor(p){this.path=p;this.name=path.basename(p);this.kind='directory';}async getDirectoryHandle(n,o={}){const p=path.join(this.path,n);if(o.create)await fs.mkdir(p,{recursive:true});else await fs.access(p).catch(()=>{const e=Error('not found');e.name='NotFoundError';throw e;});return new Dir(p);}async getFileHandle(n,o={}){const p=path.join(this.path,n);if(o.create)await fs.writeFile(p,'',{flag:'a'});else await fs.access(p).catch(()=>{const e=Error('not found');e.name='NotFoundError';throw e;});return new FH(p);}async *entries(){for(const e of await fs.readdir(this.path,{withFileTypes:true}))yield[e.name,e.isDirectory()?new Dir(path.join(this.path,e.name)):new FH(path.join(this.path,e.name))];}async queryPermission(){return'granted';}}
class FH{constructor(p){this.path=p;this.kind='file';}async getFile(){return new File([await fs.readFile(this.path)],path.basename(this.path));}async createWritable(){let data;return{write:async v=>{data=typeof v==='string'?v:Buffer.from(await v.arrayBuffer());},close:async()=>fs.writeFile(this.path,data),abort:async()=>{}};}}
(async()=>{const temp=await fs.mkdtemp(path.join(os.tmpdir(),'stagebook-test-')),dir=new Dir(temp),alerts=[];let ctx;
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};
 ctx=vm.createContext({tr:s=>s,ui:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(i<values.length?values[i]:""),""),console,exportedBlob:null,exportedName:null,closeModal:()=>{},TextEncoder,TextDecoder,Blob,File,atob,btoa,Uint8Array,Uint32Array,DataView,Map,Set,JSON,URL,Response,DecompressionStream,Error,C,lib:C.clone(demo),showId:demo.shows[0].id,songId:demo.shows[0].songs[0].id,dirty:false,editVersion:0,rootDir:dir,resources:new Map(),pendingAssets:new Map(),diskSnapshots:new Map(),appHTML:'<!doctype html><html><head></head><body>app</body></html>',PAYLOAD:{guide:'AI guide',schema:{},validator:'validator',readme:'readme'},$,window:{showDirectoryPicker:async()=>dir},showDirectoryPicker:async()=>dir,toast:s=>alerts.push(s),confirm:()=>true,confirmAction:async()=>true,pause:()=>{},snapshot:()=>{},repairSelection:()=>{},prepareHumanScene:()=>{},loadAudio:async()=>{},renderAll:()=>{},clean:()=>{ctx.dirty=false;},changed:()=>{ctx.dirty=true;},resourceFile:async k=>ctx.pendingAssets.get(k)||ctx.resources.get(k)?.getFile?.(),show:()=>ctx.lib.shows[0],song:()=>ctx.lib.shows[0].songs[0]});
 const source=(await fs.readFile(path.join(__dirname,'../src/io.js'),'utf8')).split('let draftDB;')[0];vm.runInContext(source+'\nglobalThis.api={textFiles,makeZip,readZip,parsePackage,saveFolder,reloadFolder,walkDirectory,exportPackage,openDirectory,neatPackageFiles};',ctx);
 const audioPath='shows/show-demo/songs/song-demo-01/assets/music.mp3';ctx.lib.shows[0].songs[0].audio={file:'assets/music.mp3'};ctx.pendingAssets.set(audioPath,new File([new Uint8Array([1,2,3,4])],'music.mp3'));
 await ctx.api.saveFolder();assert((await fs.readFile(path.join(temp,'index.html'),'utf8')).includes('embedded-library'));assert.deepEqual([...await fs.readFile(path.join(temp,audioPath))],[1,2,3,4]);
 const loaded=await ctx.api.parsePackage(await ctx.api.walkDirectory(dir));assert.equal(loaded.library.shows[0].songs.length,3);assert.equal(loaded.library.shows[0].songs[0].audio.file,'assets/music.mp3');
 const songPath=path.join(temp,'shows/show-demo/songs/song-demo-01/song.json');const outside=JSON.parse(await fs.readFile(songPath,'utf8'));outside.title='AI changed title';await fs.writeFile(songPath,JSON.stringify(outside));
 await ctx.api.saveFolder();assert.equal(JSON.parse(await fs.readFile(songPath,'utf8')).title,'AI changed title','Save must not overwrite external changes');assert(alerts.at(-1).includes('外部修改'));
 await ctx.api.reloadFolder();assert.equal(ctx.lib.shows[0].songs[0].title,'AI changed title');
 ctx.lib.shows[0].songs[0].notes='Manual note';await ctx.api.saveFolder();assert.equal(JSON.parse(await fs.readFile(songPath,'utf8')).notes,'Manual note');assert((await fs.readdir(path.join(temp,'backups'))).length>=1);
 ctx.lib.shows[0].pauseAtSteps=false;
 const files=ctx.api.textFiles(ctx.lib.shows);files.set(audioPath,new Blob([new Uint8Array([1,2,3,4])]));const zip=await ctx.api.makeZip(files),unzip=await ctx.api.readZip(zip),roundtrip=await ctx.api.parsePackage(unzip);assert.equal(roundtrip.library.shows[0].songs[0].notes,'Manual note');assert.equal(roundtrip.library.shows[0].pauseAtSteps,false,'Continuous playback preference survives export and import');assert.deepEqual([...new Uint8Array(await unzip.get(audioPath).arrayBuffer())],[1,2,3,4]);
 ctx.songId=ctx.lib.shows[0].songs[2].id;const focusedFiles=ctx.api.textFiles(ctx.lib.shows),workspace=JSON.parse(focusedFiles.get('manifest.json')).workspace;assert.equal(workspace.songId,ctx.songId);assert.equal((await ctx.api.parsePackage(focusedFiles)).library.workspace.songId,ctx.songId,'Package focus survives parsing');assert.equal(JSON.parse(focusedFiles.get('index.html').match(/<script id="embedded-library"[^>]*>([\s\S]*?)<\/script>/)[1]).workspace.songId,ctx.songId,'Embedded HTML carries the same selected song');ctx.songId=ctx.lib.shows[0].songs[0].id;
 // Exercise the real HTML, whose source contains the exporter's script-tag literals.
 const original=await fs.readFile(path.join(__dirname,'../dist/index.html'),'utf8');
 const scripts=html=>[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
 const executable=html=>scripts(html).filter(m=>!m[1].includes('application/json')).map(m=>m[2]);
 const originalScripts=executable(original);assert.equal(originalScripts.length,3);
 ctx.appHTML=original;ctx.lib.shows[0].songs[0].notes="Literal $& $` $' </script> must survive";
 for(let pass=0;pass<3;pass++){
  const exported=ctx.api.textFiles(ctx.lib.shows).get('index.html');
  assert.deepEqual(executable(exported),originalScripts,'Export must preserve every executable script');
  for(const script of executable(exported))new vm.Script(script);
  const embedded=scripts(exported).filter(m=>m[1].includes('embedded-library'));assert.equal(embedded.length,1);
  assert.equal(JSON.parse(embedded[0][2]).shows[0].songs[0].notes,ctx.lib.shows[0].songs[0].notes);
  ctx.appHTML=exported;
 }
 // Save must not claim edits made while asynchronous packaging was running.
 const readAsset=ctx.resourceFile;ctx.dirty=true;ctx.resourceFile=async key=>{ctx.editVersion++;return readAsset(key);};
 await ctx.api.saveFolder();assert(ctx.dirty,'Folder save must leave newer edits unsaved');ctx.resourceFile=readAsset;
 vm.runInContext('download=(blob,name)=>{exportedBlob=blob;exportedName=name;};',ctx);
 ctx.rootDir=null;ctx.dirty=true;await ctx.api.exportPackage(ctx.lib.shows);assert.equal(ctx.dirty,false);assert(ctx.exportedBlob instanceof Blob);
 const packed=new Uint8Array(await ctx.exportedBlob.arrayBuffer()),packedView=new DataView(packed.buffer),end=packed.length-22,names=[];let pos=packedView.getUint32(end+16,true);
 for(let i=0;i<packedView.getUint16(end+10,true);i++){const length=packedView.getUint16(pos+28,true);names.push(new TextDecoder().decode(packed.subarray(pos+46,pos+46+length)));pos+=46+length+packedView.getUint16(pos+30,true)+packedView.getUint16(pos+32,true);}
 assert.deepEqual([...new Set(names.map(n=>n.split('/')[0]))].sort(),['演出资料','走台本.html']);const cleanHTML=ctx.api.neatPackageFiles(ctx.api.textFiles(ctx.lib.shows)).get('走台本.html');assert(/<script id="embedded-library" data-library-root="演出资料\/"/.test(cleanHTML.slice(0,cleanHTML.indexOf('</head>'))),'Clean package HTML points to the relocated music folder');assert(names.includes('演出资料/技术资料/AI-GUIDE.md'));assert(!names.some(n=>n.endsWith('/index.html')||n==='index.html'||n.endsWith('/使用说明.txt')));
 const neatRound=await ctx.api.readZip(ctx.exportedBlob);assert.equal((await ctx.api.parsePackage(neatRound)).library.shows[0].songs[0].notes,ctx.lib.shows[0].songs[0].notes);assert.deepEqual([...new Uint8Array(await neatRound.get(audioPath).arrayBuffer())],[1,2,3,4]);
 ctx.dirty=true;ctx.resourceFile=async key=>{ctx.editVersion++;return readAsset(key);};await ctx.api.exportPackage(ctx.lib.shows);assert(ctx.dirty,'Export must leave newer edits unsaved');ctx.resourceFile=readAsset;
 const neatDir=new Dir(path.join(temp,'neat'));await fs.mkdir(neatDir.path);ctx.showDirectoryPicker=async()=>neatDir;vm.runInContext('appRootDir=null;',ctx);await ctx.api.saveFolder();
 assert.deepEqual((await fs.readdir(neatDir.path)).sort(),['演出资料','走台本.html']);assert.equal(JSON.parse(await fs.readFile(path.join(neatDir.path,'演出资料',audioPath.replace(/assets\/music.mp3$/,'song.json')),'utf8')).id,'song-demo-01');
 assert.deepEqual([...await fs.readFile(path.join(neatDir.path,'演出资料',audioPath))],[1,2,3,4]);
 await ctx.api.openDirectory(neatDir);assert.equal(ctx.lib.shows[0].pauseAtSteps,false,'Continuous playback preference survives folder save and reload');assert.equal(ctx.rootDir.name,'演出资料');assert(ctx.resources.has(audioPath));assert(!ctx.resources.has('演出资料/'+audioPath));
 ctx.lib.shows[0].songs[0].notes='Saved through clean package root';await ctx.api.saveFolder();const app=await fs.readFile(path.join(neatDir.path,'走台本.html'),'utf8');assert(app.includes('Saved through clean package root'));assert.deepEqual((await fs.readdir(neatDir.path)).sort(),['演出资料','走台本.html']);
 ctx.StageI18n={language:'en',exportHTML:html=>html};
 const englishFiles=ctx.api.neatPackageFiles(ctx.api.textFiles(ctx.lib.shows));assert(englishFiles.has('Stagebook.html'));assert(!englishFiles.has('走台本.html'));
 await ctx.api.saveFolder();assert((await fs.readFile(path.join(neatDir.path,'走台本.html'),'utf8')).includes('Saved through clean package root'),'English UI updates an existing Chinese-named entry');
 const englishDir=new Dir(path.join(temp,'english'));await fs.mkdir(englishDir.path);ctx.rootDir=null;vm.runInContext('appRootDir=null;',ctx);ctx.showDirectoryPicker=async()=>englishDir;await ctx.api.saveFolder();assert.deepEqual((await fs.readdir(englishDir.path)).sort(),['Stagebook.html','演出资料']);assert((await fs.readFile(path.join(englishDir.path,'Stagebook.html'),'utf8')).includes('embedded-library'));
 console.log('PASS: folder save / backups / external-change protection / reload / UTF-8 ZIP round trip / binary assets / executable HTML survives three exports / save revision protection');
 await fs.rm(temp,{recursive:true,force:true});
})().catch(e=>{console.error(e);process.exitCode=1;});
