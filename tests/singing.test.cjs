const assert=require('node:assert/strict'),vm=require('node:vm'),{createApp}=require('./app-harness.cjs');
(async()=>{
 const h=createApp(),q=h.api.state().lib.shows[0].songs[0];
 q.lyrics=[{id:'l1',start:3,end:5,text:'[Actor a] First voice [Actor b] Answer',notes:''},{id:'l2',start:7,end:9,text:'No singer label',notes:''},{id:'l3',start:11,end:13,text:'[a & b] Together',notes:''}];
 const raw=JSON.stringify(h.api.state().lib);h.api.seek(4);const selected=h.api.state().selectedCue;h.api.enterSinging();h.api.setSingingRoles(['a']);h.api.renderAll();
 assert(h.api.singingState().singing);assert(h.api.singingState().rehearsal);assert(h.$('#singingList').innerHTML.includes('my-words'));assert(h.$('#singingList').innerHTML.includes('Answer'));assert(h.$('#singingList').innerHTML.includes('No singer label'));
 const segments=h.api.lyricSegments(q.lyrics[0]);assert.deepEqual(Array.from(segments[0].roles),['a']);assert.deepEqual(Array.from(segments[1].roles),['b']);assert.deepEqual(Array.from(h.api.lyricSegments(q.lyrics[2])[0].roles),['a','b']);
 assert.equal(h.api.lyricSegments(q.lyrics[1])[0].roles.length,0,'Untagged lines never borrow singer identity from blocking');
 q.lyrics[1].speakerIds=['b'];assert.deepEqual(Array.from(h.api.lyricSegments(q.lyrics[1])[0].roles),['b']);delete q.lyrics[1].speakerIds;
 h.api.navigateSinging(1);assert.equal(h.api.state().current,9,'Next own line includes a two-second pickup');h.api.navigateSinging(-1);assert.equal(h.api.state().current,1);
 assert(h.api.startSingingLoop('l1','l3'));assert.deepEqual(JSON.parse(JSON.stringify(h.api.singingState().loop)),{start:1,end:13});
 q.cues[0].stopAfter=true;h.api.advance(10.2);assert(h.api.state().playing,'Practice ignores blocking pause markers without changing their setting');assert(h.api.state().current>10);
 h.api.advance(3);assert(h.api.state().current<3,'The selected passage actually loops');delete q.cues[0].stopAfter;
 assert(!h.api.startSingingLoop('l3','l1'));await h.api.singingAction('sing-stop-loop');assert.equal(h.api.singingState().loop,null);
 let prevented=false;h.api.handleSingingKey({code:'Space',key:' ',preventDefault:()=>prevented=true},false,false);assert(prevented);
 h.api.seek(8);h.api.exitSinging();assert(!h.api.singingState().singing);assert.equal(h.api.state().current,8);assert.equal(h.api.state().selectedCue,selected);assert.equal(JSON.stringify(h.api.state().lib),raw);
 const parsed=h.api.parseLyrics('[{"start":0,"end":2,"text":"Tagged","speakerIds":["a"]}]');assert.deepEqual(Array.from(parsed[0].speakerIds),['a']);assert.throws(()=>h.C.checkStructure({version:1,shows:[{...h.api.state().lib.shows[0],songs:[{...q,lyrics:[{...q.lyrics[0],speakerIds:'a'}]}]}]}));
 for(const language of ['en','zh-TW']){h.api.setInterfaceLanguage(language);h.api.enterSinging();h.api.renderAll();await h.api.singingAction('sing-roles');h.$('#dialog').close();await h.api.singingAction('sing-assign:l1');h.$('#dialog').close();await h.api.singingAction('sing-passage');h.$('#dialog').close();assert.equal(vm.runInContext('StageI18n.missing.length',h.ctx),0);h.api.exitSinging();}
 console.log('PASS: explicit and segmented singers, untagged neutrality, visible other voices, pickup navigation, real loop playback, blocking-pause bypass, exit context, unchanged production, singer import/validation, three-language practice UI');
})().catch(error=>{console.error(error);process.exitCode=1;});
