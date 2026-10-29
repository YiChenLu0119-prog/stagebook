/* Local document storage. Disk is written only by an explicit Save / Export. */
let appRootDir=null;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const json=value=>JSON.stringify(value,null,2)+'\n';
function embedLibrary(data){
 const safe=json(data).replace(/</g,'\\u003c'),headEnd=appHTML.indexOf('</head>');
 if(headEnd<0)throw Error(tr('应用文件不完整，无法导出。'));
 // Search only the head: the body contains this exporter's own script literals.
 const head=(typeof StageI18n==='undefined'?appHTML.slice(0,headEnd):StageI18n.exportHTML(appHTML.slice(0,headEnd))).replace(/<script id="embedded-library"[^>]*>[\s\S]*?<\/script>/,'').replace(/<script id="embedded-audio"[^>]*>[\s\S]*?<\/script>/,'');
 return head+`<script id="embedded-library" type="application/json">${safe}</script>`+appHTML.slice(headEnd);
}
function textFiles(shows){
 const files=new Map();files.set('manifest.json',json({format:'stagebook-library',version:1,shows:shows.map(s=>({id:s.id,path:`shows/${s.id}/show.json`}))}));
 for(const s of shows){const copy=C.clone(s);copy.songs=s.songs.map(q=>({id:q.id,title:q.title,path:`songs/${q.id}/song.json`}));files.set(`shows/${s.id}/show.json`,json(copy));for(const q of s.songs)files.set(`shows/${s.id}/songs/${q.id}/song.json`,json(q));}
 files.set('index.html',embedLibrary({version:1,shows}));files.set('走台本.html',files.get('index.html'));files.set('AI-GUIDE.md',PAYLOAD.guide);files.set('AGENTS.md',PAYLOAD.entry||'Read AI-GUIDE.md before editing.');files.set('schema.json',json(PAYLOAD.schema));files.set('validate.py',PAYLOAD.validator);files.set('使用说明.txt',PAYLOAD.readme);return files;
}
async function embedPackageAudio(files,assets=files){
 const data={};for(const [key,file]of assets){
  if(!key.endsWith('.mp3')||typeof file==='string')continue;
  const bytes=new Uint8Array(await file.arrayBuffer()),parts=[];for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  data[key]=btoa(parts.join(''));
 }
 if(!Object.keys(data).length)return;
 const html=files.get('index.html'),end=html.indexOf('</head>'),entry=html.slice(0,end)+`<script id="embedded-audio" type="application/json">${JSON.stringify(data)}</script>`+html.slice(end);
 files.set('index.html',entry);files.set('走台本.html',entry);
}
function dataPackageFiles(files){
 const out=new Map(),technical=new Set(['AI-GUIDE.md','AGENTS.md','schema.json','validate.py']);
 for(const [path,value]of files){if(path==='index.html'||path==='走台本.html'||path==='使用说明.txt')continue;out.set(technical.has(path)?'技术资料/'+path:path,value);}return out;
}
function neatPackageFiles(files){
 const html=files.get('走台本.html')||files.get('index.html'),headEnd=html.indexOf('</head>');
 const entry=html.slice(0,headEnd).replace('<script id="embedded-library"','<script id="embedded-library" data-library-root="演出资料/"')+html.slice(headEnd);
 const out=new Map([['走台本.html',entry]]);
 for(const [path,value]of dataPackageFiles(files))out.set('演出资料/'+path,value);return out;
}
function packageRootMap(map){
 if(map.has('manifest.json'))return map;
 const manifests=[...map.keys()].filter(p=>p.endsWith('/manifest.json')&&!p.split('/').includes('backups'));
 if(manifests.length!==1)throw Error(tr('未找到唯一的演出资料。请选择完整演出文件夹，或其中的「演出资料」文件夹。'));
 const prefix=manifests[0].slice(0,-'manifest.json'.length);return new Map([...map].filter(([path])=>path.startsWith(prefix)).map(([path,value])=>[path.slice(prefix.length),value]));
}
async function openDialog(){
 modal(tr('打开演出文件'),ui`<p>选择完整的演出文件夹，或导入 ZIP 演出包。新版文件夹里有「走台本.html」和「演出资料」；旧版文件夹也可用。</p><div class="stack"><button id="pickDirectory" class="gold">打开可直接编辑保存的文件夹</button><button id="importFolder">导入文件夹（只读来源，编辑后另存）</button><button id="importZip">导入 ZIP 演出包</button></div><p class="footer-note">Mac 推荐使用支持文件夹读写的 Chrome / Edge。Safari 等不支持直接写回的浏览器可导入后导出 ZIP。应用没有网络请求、登录或在线依赖。</p>`);
 $('#pickDirectory').onclick=async()=>{if(!window.showDirectoryPicker)return toast(tr('当前浏览器不支持直接文件夹读写，请用导入／导出方式或 Chrome / Edge。'));if(dirty&&!confirm(tr('当前有未保存修改，打开其他文件夹会替换工作区。继续？')))return;try{const dir=await showDirectoryPicker({mode:'readwrite'});await openDirectory(dir);closeModal();}catch(e){if(e.name!=='AbortError')toast(e.message);}};
 $('#importFolder').onclick=()=>$('#folderInput').click();$('#importZip').onclick=()=>$('#zipInput').click();
}
async function walkDirectory(dir,prefix='',map=new Map()){
 for await(const [name,entry]of dir.entries()){if(name.startsWith('.')||name==='backups')continue;const path=prefix+name;if(entry.kind==='directory')await walkDirectory(entry,path+'/',map);else map.set(path,entry);}return map;
}
async function parsePackage(map){
 map=packageRootMap(map);const strings=new Map();async function read(path){if(!C.safePath(path))throw Error(tr('不安全的文件路径：')+path);const v=map.get(path);if(!v)throw Error(tr('找不到文件：')+path);const f=v.getFile?await v.getFile():v;const text=typeof f==='string'?f:await f.text();strings.set(path,text);try{return JSON.parse(text);}catch{throw Error(path+tr('：JSON 无法解析。'));}}
 const manifest=await read('manifest.json');if(manifest.version!==1||manifest.format!=='stagebook-library'||!Array.isArray(manifest.shows))throw Error(tr('不支持的演出文件版本。'));
 const next={version:1,shows:[]};for(const entry of manifest.shows){const s=await read(entry.path);const base=entry.path.slice(0,entry.path.lastIndexOf('/')+1),songs=[];for(const q of s.songs){if(!C.safePath(q.path))throw Error(tr('曲目路径无效。'));songs.push(await read(base+q.path));}s.songs=songs;if(s.id!==entry.id)throw Error(tr('演出 ID 与 manifest 不一致。'));next.shows.push(s);}
 if(!next.shows.length||next.shows.some(s=>!s.songs.length))throw Error(tr('每个演出库需要演出，每场演出至少保留一首曲目。'));C.checkStructure(next);return{library:next,snapshots:strings,resources:map};
}
async function openDirectory(dir){
 let dataDir=dir,parent=null;if(await diskText(dir,'manifest.json')===null){try{dataDir=await dir.getDirectoryHandle('演出资料');parent=dir;}catch{throw Error(tr('请选择包含「走台本.html」和「演出资料」的完整文件夹。'));}}
 const parsed=await parsePackage(await walkDirectory(dataDir));pause();snapshot();lib=parsed.library;rootDir=dataDir;appRootDir=parent;resources=parsed.resources;pendingAssets=new Map();diskSnapshots=parsed.snapshots;repairSelection();clean();renderAll();await loadAudio();if(lib!==parsed.library)return;renderAll();toast(tr('已打开 ')+dir.name+' · '+lib.shows.length+tr(' 场演出'));
}
async function importMap(map){if(dirty&&!confirm(tr('导入将替换当前工作区。继续？')))return;const parsed=await parsePackage(map);pause();snapshot();lib=parsed.library;resources=parsed.resources;rootDir=null;appRootDir=null;pendingAssets=new Map();diskSnapshots=new Map();repairSelection();changed();renderAll();closeModal();await loadAudio();if(lib!==parsed.library)return;renderAll();toast(tr('演出已导入；可以选择文件夹保存，或导出新演出包。'));}
$('#folderInput').onchange=async e=>{try{const map=new Map();for(const f of e.target.files){const path=f.webkitRelativePath.split('/').slice(1).join('/');if(C.safePath(path))map.set(path,f);}await importMap(map);}catch(error){toast(error.message);}e.target.value='';};
async function diskText(dir,path){try{const parts=path.split('/');let d=dir;for(const n of parts.slice(0,-1))d=await d.getDirectoryHandle(n);return await(await(await d.getFileHandle(parts.at(-1))).getFile()).text();}catch(e){if(e.name==='NotFoundError')return null;throw e;}}
async function writeDisk(dir,path,value){if(!C.safePath(path))throw Error(tr('不安全的保存路径。'));const parts=path.split('/');let d=dir;for(const n of parts.slice(0,-1))d=await d.getDirectoryHandle(n,{create:true});const handle=await d.getFileHandle(parts.at(-1),{create:true});const writer=await handle.createWritable();try{await writer.write(value);await writer.close();}catch(e){try{await writer.abort();}catch{}throw e;}}
// Choose a file destination only when no writable folder is connected.
async function saveWork(){
 if(rootDir){await saveFolder();return;}
 modal(tr('保存走台'),ui`<p>下载一份完整演出包，下次可通过「导入走台」继续编辑。</p><div class="stack"><button id="downloadWork" class="gold">下载演出包</button><button id="connectSaveFolder" ${!window.showDirectoryPicker?'disabled':''}>保存到文件夹…</button></div><p class="footer-note">浏览器草稿用于意外恢复；正式保留和发给别人，请保存演出包。</p>`);
 $('#downloadWork').onclick=()=>exportPackage(lib.shows);
 $('#connectSaveFolder').onclick=async()=>{closeModal();try{await saveFolder();}catch(e){toast(e.message);}};
}
let folderSaving=false;
async function saveFolder(){
 if(folderSaving)return;
 if(!window.showDirectoryPicker){exportDialog();toast(tr('此浏览器采用导出演出包保存。'));return;}
 folderSaving=true;const revision=editVersion,savedLibrary=C.clone(lib),savedAssets=new Map(pendingAssets);let dir=rootDir,parent=appRootDir;try{if(!dir){const picked=await showDirectoryPicker({mode:'readwrite'});if(await diskText(picked,'manifest.json')!==null){dir=picked;parent=null;}else{parent=picked;dir=await picked.getDirectoryHandle('演出资料',{create:true});}}else if(await dir.queryPermission({mode:'readwrite'})!=='granted'&&await dir.requestPermission({mode:'readwrite'})!=='granted')return;
  const same=dir===rootDir;const oldManifest=await diskText(dir,'manifest.json');
  if(!same&&oldManifest&&!confirm(tr('这个文件夹已有演出库。保存当前工作区将更新它的 manifest；旧数据会先备份。继续？')))return;
  if(same){for(const [path,before]of diskSnapshots){const latest=await diskText(dir,path);if(latest!==before){toast(tr('文件已被外部修改。请先“重新加载”，或导出当前版本为另一份演出包。'));return;}}}
  const canonical=textFiles(savedLibrary.shows),files=parent?dataPackageFiles(canonical):canonical,missing=[],audioFiles=new Map();
  for(const s of savedLibrary.shows)for(const q of s.songs)if(q.audio){const key=`shows/${s.id}/songs/${q.id}/${q.audio.file}`,f=await resourceFile(key);if(f){audioFiles.set(key,f);if(!same||pendingAssets.has(key)||!resources.has(key))files.set(key,f);}else if(!same||!resources.has(key))missing.push(q.title);}
  if(missing.length&&!confirm(tr('这些曲目未连接音频文件：')+missing.join('、')+tr('。仍保存走台和歌词，保留音频引用？')))return;
  await embedPackageAudio(canonical,audioFiles);
  if(oldManifest){const stamp=new Date().toISOString().replace(/[:.]/g,'-');const existing=await walkDirectory(dir);for(const [path,h]of existing)if(path.endsWith('.json')&&!path.startsWith('backups/'))await writeDisk(dir,`backups/${stamp}/${path}`,await(await h.getFile()).text());}
  for(const [path,value]of files)if(path!=='manifest.json')await writeDisk(dir,path,value);if(parent)await writeDisk(parent,'走台本.html',neatPackageFiles(canonical).get('走台本.html'));await writeDisk(dir,'manifest.json',files.get('manifest.json'));
  rootDir=dir;appRootDir=parent;diskSnapshots=new Map([...files].filter(([k,v])=>k.endsWith('.json')&&typeof v==='string'&&!k.endsWith('schema.json')));resources=await walkDirectory(dir);for(const [key,file]of savedAssets)if(pendingAssets.get(key)===file)pendingAssets.delete(key);if(!missing.length&&revision===editVersion)clean();renderAll();toast(missing.length?tr('走台已保存，但缺少音乐；连接后请重新保存。'):revision===editVersion?tr('已保存到 ')+dir.name:tr('文件已保存；保存期间的新修改仍需保存。'));
 }catch(e){if(e.name!=='AbortError')throw e;}finally{folderSaving=false;}
}
async function reloadFolder(){
 if(!rootDir){toast(tr('尚未连接演出文件夹，请先打开文件夹；导入 ZIP 的工作区可重新导入新 ZIP。'));return;}
 if(dirty&&!confirm(tr('当前有未保存修改。重新加载将以磁盘文件替换工作区；可通过撤销恢复当前内容。继续？')))return;
 const map=await walkDirectory(rootDir),parsed=await parsePackage(map);pause();snapshot();const oldShow=showId,oldSong=songId;lib=parsed.library;resources=parsed.resources;pendingAssets.clear();diskSnapshots=parsed.snapshots;showId=oldShow;songId=oldSong;repairSelection();clean();renderAll();await loadAudio();if(lib!==parsed.library)return;renderAll();toast(tr('已重新读取文件；结构问题会阻止加载，走台问题会标红并保留。'));
}
function exportDialog(){modal(tr('发给演员'),ui`<p>下载演出包发给演员。对方解压后，打开「走台本.html」即可查看、排练和编辑。</p><div class="stack"><button id="exportShow" class="gold">下载「${esc(show().title)}」</button><button id="exportAll">下载全部演出（${lib.shows.length} 场）</button></div><p class="footer-note">演出包包含走台、歌词和已导入的音乐。</p>`);$('#exportShow').onclick=()=>exportPackage([show()]);$('#exportAll').onclick=()=>exportPackage(lib.shows);}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const crcTable=(()=>{const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}return table;})();
function crc32(data){let c=0xffffffff;for(const byte of data)c=crcTable[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
async function makeZip(files){
 const chunks=[],central=[];let offset=0;
 for(const [path,value]of files){const name=encoder.encode(path),bytes=typeof value==='string'?encoder.encode(value):new Uint8Array(await value.arrayBuffer()),crc=crc32(bytes),header=new Uint8Array(30),v=new DataView(header.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);chunks.push(header,name,bytes);
  const dir=new Uint8Array(46),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);central.push(dir,name);offset+=header.length+name.length+bytes.length;
  if(offset>0xffffffff)throw Error(tr('ZIP 超过 4GB，请分演出导出或使用文件夹保存。'));
 }
 const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.size,true);e.setUint16(10,files.size,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});
}
async function readZip(file){
 const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer);let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}if(end<0)throw Error(tr('找不到 ZIP 目录。'));const count=v.getUint16(end+10,true);if(count>10000)throw Error(tr('ZIP 文件数量过多。'));let pos=v.getUint32(end+16,true),sizeTotal=0;const map=new Map();
 for(let n=0;n<count;n++){if(v.getUint32(pos,true)!==0x02014b50)throw Error(tr('ZIP 目录损坏。'));const method=v.getUint16(pos+10,true),compressed=v.getUint32(pos+20,true),expected=v.getUint32(pos+24,true),nameLen=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),offset=v.getUint32(pos+42,true),path=decoder.decode(bytes.subarray(pos+46,pos+46+nameLen));pos+=46+nameLen+extra+comment;if(path.endsWith('/'))continue;if(!C.safePath(path))throw Error(tr('ZIP 包含无效路径。'));sizeTotal+=expected;if(sizeTotal>2*1024**3)throw Error(tr('ZIP 解压后超过 2GB，请使用文件夹方式。'));const start=offset+30+v.getUint16(offset+26,true)+v.getUint16(offset+28,true);let blob=new Blob([bytes.subarray(start,start+compressed)]);if(method===8){if(!globalThis.DecompressionStream)throw Error(tr('浏览器不支持此压缩包，请先手动解压，再导入文件夹。'));blob=await new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();}else if(method!==0)throw Error(tr('此 ZIP 压缩方式不受支持。'));if(blob.size!==expected)throw Error(tr('ZIP 文件长度校验失败。'));map.set(path,blob);}
 if(!map.has('manifest.json')){const candidates=[...map.keys()].filter(p=>p.endsWith('/manifest.json'));if(candidates.length===1){const prefix=candidates[0].slice(0,-'manifest.json'.length),clean=new Map();for(const [k,val]of map)if(k.startsWith(prefix))clean.set(k.slice(prefix.length),val);return clean;}}return map;
}
let exporting=false;
async function exportPackage(shows){
 if(exporting)return;exporting=true;
 const revision=editVersion,complete=shows.length===lib.shows.length&&shows.every(s=>lib.shows.some(x=>x.id===s.id)),snapshotShows=C.clone(shows);
 try{const files=textFiles(snapshotShows),missing=[];for(const s of snapshotShows)for(const q of s.songs)if(q.audio){const key=`shows/${s.id}/songs/${q.id}/${q.audio.file}`,f=await resourceFile(key);if(f)files.set(key,f);else missing.push(q.title);}
  if(missing.length&&!confirm(tr('以下曲目未连接音乐：')+missing.join('、')+tr('。仍要下载不含这些音乐的走台数据包吗？')))return;
  toast(tr('正在打包，请稍候…'));await embedPackageAudio(files);const blob=await makeZip(neatPackageFiles(files));download(blob,(shows.length===1?shows[0].title:tr('走台演出库')).replace(/[\\/:*?"<>|]/g,'-')+'.zip');closeModal();if(complete&&!missing.length&&!rootDir&&revision===editVersion)clean();toast(missing.length?tr('已下载走台数据，但缺少音乐。连接音乐后请重新保存。'):revision===editVersion?tr('演出包已下载，包含走台、歌词和已连接的音乐。'):tr('演出包已下载；打包期间的新修改仍需保存。'));
 }catch(e){toast(e.message);}finally{exporting=false;}
}
$('#zipInput').onchange=async e=>{try{if(e.target.files[0])await importMap(await readZip(e.target.files[0]));}catch(error){toast(error.message);}e.target.value='';};
function interfaceReadme(){return PAYLOAD.readmes?.[StageI18n.language]||PAYLOAD.readme;}
function interfaceAIGuide(){return PAYLOAD.guides?.[StageI18n.language]||PAYLOAD.guide;}
function helpDialog(){modal(tr('使用说明与 AI 编辑指南'),ui`<div class="row wrap"><button id="helpReadme" class="selected">使用说明</button><button id="helpAI">大模型指南</button><button id="downloadGuide">下载指南与格式</button></div><pre id="helpText">${esc(interfaceReadme())}</pre><p class="footer-note">应用不内置联网 AI。把演出文件交给外部 AI 修改；先保存你的界面编辑，AI 完成后点“重新加载”。</p>`);$('#helpReadme').onclick=()=>$('#helpText').textContent=interfaceReadme();$('#helpAI').onclick=()=>$('#helpText').textContent=interfaceAIGuide();$('#downloadGuide').onclick=async()=>{download(await makeZip(new Map([['AI-GUIDE.md',PAYLOAD.guide],['schema.json',json(PAYLOAD.schema)],['validate.py',PAYLOAD.validator]])),'Stagebook-AI-Guide.zip');};}
let draftDB;
async function db(){if(draftDB)return draftDB;draftDB=await new Promise((resolve,reject)=>{const r=indexedDB.open('stagebook-offline-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return draftDB;}
async function dbRead(key){const database=await db();return new Promise((resolve,reject)=>{const r=database.transaction('state').objectStore('state').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function saveDraft(){
 if(restoring)return;try{const database=await db();await new Promise((resolve,reject)=>{const tx=database.transaction('state','readwrite'),store=tx.objectStore('state');store.put({library:lib,showId,songId,dirty,when:Date.now(),sourceName:rootDir?.name||null},'draft');for(const [key,file]of pendingAssets)store.put(file,'audio:'+key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});if(dirty){$('#saveState').textContent=tr('未保存 · 有恢复草稿');$('#saveState').title=tr('浏览器已暂存恢复草稿；点击保存，下载正式演出包。');}}catch(e){if(!saveDraft.warned){toast(tr('浏览器未能保留恢复草稿，请及时手动保存或导出。'));saveDraft.warned=true;}}
}
function recoverySummary(library,sid,qid,label){
 const shows=library?.shows||[],s=shows.find(s=>s.id===sid)||shows[0],q=s?.songs?.find(q=>q.id===qid)||s?.songs?.[0],songs=shows.reduce((n,s)=>n+(s.songs?.length||0),0);
 return ui`<section class="recovery-choice"><b>${label}</b><strong>${esc(q?.title||s?.title||tr('未命名演出'))}</strong><span>${songs} 首曲目 · 当前 ${q?.cues?.length||0} 步 · ${q?.lyrics?.length||0} 句歌词</span></section>`;
}
async function boot(){
 const embedded=$('#embedded-library');if(embedded)try{lib=C.checkStructure(JSON.parse(embedded.textContent));showId=lib.shows[0].id;songId=lib.shows[0].songs[0].id;}catch(e){toast(tr('嵌入数据无效，已打开示例：')+e.message);}
 focusActor=song().castIds[0]||'';prepareHumanScene();renderAll();if(embedded)$('#saveState').textContent=tr('已打开');
 try{const saved=await dbRead('draft');if(saved?.dirty){restoring=true;modal(tr('发现未保存的恢复草稿'),ui`<div class="recovery-comparison">${recoverySummary(lib,showId,songId,tr('当前文件'))}${recoverySummary(saved.library,saved.showId,saved.songId,tr('未保存草稿'))}</div><p class="footer-note">草稿时间：${esc(new Date(saved.when).toLocaleString(StageI18n.language))}。恢复草稿不会覆盖磁盘文件。</p><div class="dialogactions"><button id="discardDraft">使用当前文件</button><button id="restoreDraft" class="gold">恢复草稿</button></div>`);$('#discardDraft').onclick=()=>{restoring=false;closeModal();saveDraft();};$('#restoreDraft').onclick=async()=>{try{lib=C.checkStructure(saved.library);showId=saved.showId;songId=saved.songId;repairSelection();for(const s of lib.shows)for(const q of s.songs)if(q.audio){const key=`shows/${s.id}/songs/${q.id}/${q.audio.file}`,blob=await dbRead('audio:'+key);if(blob)pendingAssets.set(key,blob);}restoring=false;changed();closeModal();renderAll();await loadAudio();renderAll();toast(tr('草稿已恢复，请保存到新文件夹或导出演出包。'));}catch(e){toast(e.message);}};}}
 catch(e){/* Draft recovery is optional; all explicit file operations remain available. */}
 await loadAudio();updateTransport();
}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('resize',updatePlayhead);
boot().catch(e=>{console.error(e);toast(tr('启动失败：')+e.message);});
