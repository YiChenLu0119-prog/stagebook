const assert=require('node:assert/strict');
const vm=require('node:vm');
const {createApp}=require('./app-harness.cjs');

(async()=>{
 const storage=new Map(),localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 const app=createApp(),run=code=>vm.runInContext(code,app.ctx);
 app.ctx.localStorage=localStorage;
 run(`show().songs.push({...C.clone(song()),id:'second',title:'Second'},{...C.clone(song()),id:'third',title:'Third',castIds:['a']});beginSongVisit();`);
 const production=JSON.stringify(app.api.state().lib);
 run("rehearsal=true;focusActor='b';seek(12.4)");
 await app.api.switchSong('second');
 assert.equal(run('focusActor'),'b','Keep the same role when it participates in the next song');
 assert.equal(app.api.state().current,0);
 await app.api.switchSong('third');
 assert.equal(run('focusActor'),'a','A missing role falls back to a participating role');
 await app.api.switchSong('q');
 assert.equal(app.api.state().current,0,'Returning never jumps without an explicit choice');
 assert.match(app.$('#songResumeContinue').textContent,/00:12[.]4.*Actor b/);
 assert.equal(app.$('#songResume').hidden,false);
 await app.api.switchSong('second');
 await app.api.switchSong('q');
 assert.match(app.$('#songResumeContinue').textContent,/00:12.4.*Actor b/,'An untouched visit must not overwrite the saved position');
 run('chooseSongResume(true)');
 assert.equal(app.api.state().current,12.4);
 assert.equal(run('focusActor'),'b');
 assert.equal(app.$('#songResume').hidden,true);
 assert.equal(JSON.stringify(app.api.state().lib),production);
 assert.equal(app.api.state().history,0);

 const reopened=createApp(),runReopened=code=>vm.runInContext(code,reopened.ctx);
 reopened.ctx.localStorage=localStorage;
 runReopened('beginSongVisit();renderSongResume()');
 assert.equal(reopened.api.state().current,0);
 assert.match(reopened.$('#songResumeContinue').textContent,/00:12.4.*Actor b/,'A new window reads a persisted bookmark');
 runReopened('chooseSongResume(false);beginSongVisit();renderSongResume()');
 assert.equal(reopened.api.state().current,0);
 assert.equal(reopened.$('#songResume').hidden,true);
 assert.equal(reopened.api.state().history,0);

 run("operationPrefs.keepActor=false;operationPrefs.rememberSong=false");
 run("focusActor='b';seek(8)");
 await app.api.switchSong('second');
 assert.equal(run('focusActor'),'a','Disable keeping the role when the preference is off');
 await app.api.switchSong('q');
 assert.equal(app.$('#songResume').hidden,true,'Disable the continue card when the preference is off');

 const unavailable=createApp();
 unavailable.ctx.localStorage={getItem(){throw Error('Storage unavailable');},setItem(){throw Error('Storage unavailable');}};
 vm.runInContext('beginSongVisit();seek(7);saveSongVisit();prepareHumanScene();beginSongVisit();renderSongResume()',unavailable.ctx);
 assert.match(unavailable.$('#songResumeContinue').textContent,/00:07.0/,'Switching still works within a tab if local storage is unavailable');
 console.log('PASS: per-song positions, explicit resume and restart, stable role when switching, reload/local storage, and unchanged production.');
})().catch(error=>{console.error(error);process.exitCode=1;});
