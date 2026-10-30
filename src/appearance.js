/* Appearance is a browser preference, never production data. No network assets. */
const appearancePalettes=[
 {id:'phantom',name:'剧院魅影',description:'墨黑 · 象牙 · 绯红',colors:['#19171b','#f1ecdf','#f39b9e']},
 {id:'rent',name:'吉屋出租',description:'黑白 · 海报红',colors:['#181818','#f7f4ef','#ff8d7e']},
 {id:'hamilton',name:'汉密尔顿',description:'墨黑 · 旧金',colors:['#1d1b17','#f1ecdf','#e8ba57']},
 {id:'evan',name:'致埃文·汉森',description:'午夜蓝 · 天蓝',colors:['#14212d','#f1ecdf','#8ed3f0']}
];
let appearance='hamilton';
try{const saved=localStorage.getItem('stagebook-appearance');if(appearancePalettes.some(p=>p.id===saved))appearance=saved;}catch{}
function setAppearance(id){
 if(!appearancePalettes.some(p=>p.id===id))return;
 appearance=id;document.documentElement.setAttribute('data-theme',id);
 try{localStorage.setItem('stagebook-appearance',id);}catch{}
}
setAppearance(appearance);
function appearanceDialog(){
 modal(tr('外观'),ui`<p class="appearance-intro">为排练工作台选择配色。</p><div class="appearance-options">${appearancePalettes.map(p=>`<button class="appearance-option" data-palette="${p.id}" aria-pressed="${p.id===appearance}"><span class="palette-swatches" aria-hidden="true">${p.colors.map(c=>`<i style="background:${c}"></i>`).join('')}</span><span class="palette-copy"><strong>${tr(p.name)}</strong><small>${tr(p.description)}</small></span><span class="palette-check" aria-hidden="true">${p.id===appearance?'✓':''}</span></button>`).join('')}</div><p class="footer-note">剧目配色为设计灵感，并非官方主题。仅保存在此浏览器，不改变演员颜色、演出内容或分享包。</p>`);
 for(const button of $$('[data-palette]'))button.onclick=()=>{
  setAppearance(button.dataset.palette);
  for(const item of $$('[data-palette]')){const on=item.dataset.palette===appearance;item.setAttribute('aria-pressed',String(on));item.querySelector('.palette-check').textContent=on?'✓':'';}
 };
}
