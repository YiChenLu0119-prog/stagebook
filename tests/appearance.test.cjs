// Changing browser appearance must never change production content or editing context.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createApp}=require('./app-harness.cjs');
const {api,ctx,document}=createApp();
const saved=new Map([['stagebook-appearance','evan']]);
ctx.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/appearance.js'),'utf8'),ctx);
assert.equal(document.documentElement.getAttribute('data-theme'),'evan');
api.seek(7.3);const before=JSON.stringify(api.state());
for(const theme of ['phantom','rent','hamilton','evan']){
 vm.runInContext(`setAppearance('${theme}')`,ctx);
 assert.equal(document.documentElement.getAttribute('data-theme'),theme);
 assert.equal(saved.get('stagebook-appearance'),theme);
 assert.equal(JSON.stringify(api.state()),before);
}
vm.runInContext("setAppearance('invalid')",ctx);assert.equal(document.documentElement.getAttribute('data-theme'),'evan');
ctx.localStorage.setItem=()=>{throw Error('unavailable');};
vm.runInContext("setAppearance('hamilton')",ctx);assert.equal(document.documentElement.getAttribute('data-theme'),'hamilton');
console.log('PASS: persisted theme, all four palettes preserve production and editing state, invalid preference and unavailable storage');
for(const stored of [null,'rehearsal','unknown',new Error('storage unavailable')]){
 const fresh=createApp(),content=JSON.stringify(fresh.api.state());
 fresh.ctx.localStorage={getItem:()=>{if(stored instanceof Error)throw stored;return stored;},setItem:()=>{}};
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/appearance.js'),'utf8'),fresh.ctx);
 assert.equal(fresh.document.documentElement.getAttribute('data-theme'),'hamilton');
 assert.equal(JSON.stringify(fresh.api.state()),content);
}
console.log('PASS: Hamilton default, invalid/legacy appearance and storage-read failure preserve production');
const h=createApp();
h.api.state().lib.shows[0].songs[0].lyrics=[{id:'l1',start:0,end:10,text:'Test line',notes:''}];
h.api.renderLyricsDock(true);
let behavior;
h.$('#lyricsList').lyricRows[0].scrollIntoView=options=>behavior=options.behavior;
h.ctx.window.matchMedia=()=>({matches:true});h.api.updateLyricsFocus(true);assert.equal(behavior,'auto');
h.ctx.window.matchMedia=()=>({matches:false});h.api.updateLyricsFocus(true);assert.equal(behavior,'smooth');
console.log('PASS: reduced motion disables animated lyric following without disabling follow');
