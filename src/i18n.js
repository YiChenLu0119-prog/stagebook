/* UI language is independent of production data. Interpolated content is opaque. */
(function(root){
 'use strict';
 const messages=/*__LOCALES__*/{};
 const supported=['zh-CN','zh-TW','en'],storageKey='stagebook.ui-language';
 function normalize(value){const s=String(value||'').toLowerCase();if(/^zh-(tw|hk|mo|hant)/.test(s))return 'zh-TW';if(/^zh/.test(s))return 'zh-CN';return 'en';}
 let language='zh-CN';
 try{const saved=root.localStorage?.getItem(storageKey),embedded=root.document?.documentElement?.getAttribute('data-ui-language');language=saved&&supported.includes(saved)?saved:embedded&&supported.includes(embedded)?embedded:root.navigator?.language?normalize(root.navigator.language):'zh-CN';}catch{if(root.navigator?.language)language=normalize(root.navigator.language);}
 const missing=new Set();
 function translated(source){
  if(language==='zh-CN')return source;
  const key=source.trim();if(!key)return source;
  const indices=[];const canonical=key.replace(/\{(\d+)\}/g,(_,index)=>{if(!indices.includes(index))indices.push(index);return '{'+indices.indexOf(index)+'}';});
  const value=messages[language]?.[canonical];
  if(value===undefined){if(/[\u3400-\u9fff]/.test(key))missing.add(key);return source;}
  const restored=value.replace(/\{(\d+)\}/g,(_,index)=>'{'+indices[index]+'}');
  return source.slice(0,source.indexOf(key))+restored+source.slice(source.indexOf(key)+key.length);
 }
 function translateHTML(source){
  if(!/<[a-zA-Z/][^>]*>/.test(source))return translated(source);
  return source.split(/(<[^>]*>)/g).map(part=>part.startsWith('<')?part.replace(/\b(title|aria-label|placeholder|alt)="([^"]*)"/g,(_,name,text)=>name+'="'+translated(text)+'"'):translated(part)).join('');
 }
 function interpolate(source,values){return source.replace(/\{(\d+)\}/g,(all,index)=>Number(index)<values.length?String(values[index]??''):all);}
 function translate(source){return translateHTML(String(source));}
 function html(strings,...values){let source='';strings.forEach((part,index)=>{source+=part;if(index<values.length)source+='{'+index+'}';});return interpolate(translateHTML(source),values);}
 function setLanguage(value){if(!supported.includes(value))return false;language=value;missing.clear();try{root.localStorage?.setItem(storageKey,value);}catch{}if(root.document?.documentElement){root.document.documentElement.setAttribute('lang',value);root.document.documentElement.setAttribute('data-ui-language',value);root.document.documentElement.setAttribute('dir','ltr');}return true;}
 function applyStatic(doc=root.document){
  if(!doc?.querySelectorAll)return;
  doc.documentElement?.setAttribute('lang',language);
  for(const node of doc.querySelectorAll('[data-i18n]'))node.textContent=translated(node.getAttribute('data-i18n'));
  for(const name of ['title','aria-label','placeholder'])for(const node of doc.querySelectorAll('[data-i18n-'+name+']'))node.setAttribute(name,translated(node.getAttribute('data-i18n-'+name)));
  const picker=doc.querySelector('#interfaceLanguage');if(picker)picker.value=language;
 }
 function retranslateStatus(text,previousLanguage){if(previousLanguage==='zh-CN')return translate(text);const entry=Object.entries(messages[previousLanguage]||{}).find(([,value])=>value===text);return entry?translate(entry[0]):text;}
 function exportHTML(source){return source.replace(/<html\b([^>]*)>/i,(_,attrs)=>'<html'+attrs.replace(/\s(?:lang|data-ui-language|dir)="[^"]*"/g,'')+' lang="'+language+'" data-ui-language="'+language+'" dir="ltr">');}
 const api={translate,html,applyStatic,setLanguage,retranslateStatus,exportHTML,normalize,supported,get language(){return language;},get missing(){return [...missing];},messages};
 root.StageI18n=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
