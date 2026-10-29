const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{spawnSync}=require('node:child_process'),C=require('../src/core.js');
(async()=>{
 const root=path.resolve(__dirname,'..'),guide=fs.readFileSync(path.join(root,'AI-GUIDE.md'),'utf8'),blocks=[...guide.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].filter(m=>['{','['].includes(m[1].trim()[0])).map(m=>JSON.parse(m[1]));
 const manifest=blocks.find(v=>v.format==='stagebook-library'),show=blocks.find(v=>v.stage&&v.actors),song=blocks.find(v=>v.cues&&v.initial);
 assert(manifest&&show&&song,'The guide must contain complete executable examples');
 const showPath=manifest.shows[0].path,songPath=path.posix.dirname(showPath)+'/'+show.songs[0].path,files=new Map([['manifest.json',JSON.stringify(manifest)],[showPath,JSON.stringify(show)],[songPath,JSON.stringify(song)]]);
 const nodes=new Map(),$=key=>{if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);},ctx=vm.createContext({C,TextEncoder,TextDecoder,console,Map,Set,JSON,Error,$,tr:s=>s});
 const io=fs.readFileSync(path.join(root,'src/io.js'),'utf8').split('let draftDB;')[0];vm.runInContext(io+'\nglobalThis.parse=parsePackage;',ctx);
 const imported=await ctx.parse(files);assert.equal(imported.library.shows[0].songs[0].id,song.id);assert.equal(imported.library.shows[0].actors[0].id,show.actors[0].id);
 const wrapped=new Map([...files].map(([name,text])=>['演出资料/'+name,text]));assert.equal((await ctx.parse(wrapped)).library.shows[0].id,show.id,'A wrapped production archive follows the same guide');
 const incomplete=new Map(files);incomplete.delete(songPath);await assert.rejects(ctx.parse(incomplete),/song.json/);await assert.rejects(ctx.parse(new Map([['song.json',JSON.stringify(song)]])),/manifest|演出资料/);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'stagebook-ai-guide-'));try{for(const [name,text]of files){fs.mkdirSync(path.dirname(path.join(temp,name)),{recursive:true});fs.writeFileSync(path.join(temp,name),text);}const result=spawnSync('python3',[path.join(root,'validate.py'),temp,'--json'],{encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);}finally{fs.rmSync(temp,{recursive:true,force:true});}
 console.log('PASS: AI guide examples form a complete importable library in flat and wrapped layouts, missing/single-song packages are rejected, and the portable validator accepts the documented example');
})().catch(error=>{console.error(error);process.exitCode=1;});
