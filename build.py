#!/usr/bin/env python3
import json,pathlib,shutil,zipfile
ROOT=pathlib.Path(__file__).resolve().parent
def schema():
    ref=lambda name:{'$ref':'#/$defs/'+name}
    arr=lambda val:{'type':'array','items':val}
    obj=lambda properties,required=[]:{'type':'object','properties':properties,'required':required}
    string={'type':'string'};num={'type':'number'};nonneg={'type':'number','minimum':0};notes={'notes':string}
    defs={};defs['xy']=obj({'x':num,'y':num},['x','y']);defs['point']=obj({'x':num,'y':num,'c1':ref('xy'),'c2':ref('xy')},['x','y']);defs['point']['dependentRequired']={'c1':['c2'],'c2':['c1']}
    defs['path']=dict(type='array',items=ref('point'),minItems=2)
    defs['entity']=obj({'id':string,'name':string,'label':string,'color':{'type':'string','pattern':'^#[0-9a-fA-F]{6}$'},**notes},['id','name','label','color'])
    defs['area']=obj({'id':string,'name':string,'points':ref('path'),**notes},['id','name','points'])
    defs['anchor']=obj({'id':string,'name':string,'x':num,'y':num,'kind':{'enum':['gate','mark']},**notes},['id','name','x','y'])
    defs['stage']=obj({'audience':{'enum':['north','south','east','west']},'boundary':{'type':'array','minItems':3,'items':ref('point')},'backstage':arr(ref('area')),'walls':arr(ref('area')),'anchors':arr(ref('anchor')),**notes},['boundary','backstage','walls','anchors','audience'])
    defs['move']=obj({'id':string,'entityId':string,'points':ref('path'),'gateId':string,'startOffset':nonneg,'duration':nonneg,**notes},['id','entityId','points'])
    defs['cue']=obj({'id':string,'title':string,'at':nonneg,'duration':nonneg,'stopAfter':{'type':'boolean'},'moves':arr(ref('move')),**notes},['id','title','at','duration','moves'])
    defs['lyric']=obj({'id':string,'start':nonneg,'end':nonneg,'text':string,**notes},['id','start','end','text'])
    nullable={'type':['number','null'],'minimum':0}
    defs['annotation']=obj({'id':string,'title':string,'start':nullable,'end':nullable,'entityIds':arr(string),**notes},['id','title','entityIds','notes'])
    defs['song']=obj({'id':string,'title':string,'mode':{'enum':['steps','timed']},'audio':{'oneOf':[{'type':'null'},obj({'file':string,'originalName':string},['file'])]},'duration':nullable,'castIds':arr(string),'propIds':arr(string),'initial':{'type':'object','additionalProperties':ref('xy')},'cues':arr(ref('cue')),'lyrics':arr(ref('lyric')),'annotations':arr(ref('annotation')),**notes},['id','title','mode','castIds','propIds','initial','cues','lyrics','annotations'])
    defs['show']=obj({'id':string,'title':string,'stage':ref('stage'),'pauseAtSteps':{'type':'boolean'},'actors':arr(ref('entity')),'props':arr(ref('entity')),'songs':arr(obj({'id':string,'title':string,'path':string},['id','path'])),**notes},['id','title','stage','actors','props','songs'])
    defs['handoff']=obj({k:string for k in ['id','label','createdAt','summary','fingerprint']},['id','label','createdAt','summary','fingerprint'])
    defs['rehearsalRef']=obj({'id':string,'songId':{'type':['string','null']},'sourceType':{'enum':['show','stage','song','entity','cue','move','lyric','annotation','anchor','wall','backstage']},'sourceId':string,'cueId':string,'status':{'enum':['discussion','decided','checked']},'checkedFingerprint':string},['id','sourceType','sourceId','status'])
    defs['show']['properties'].update({'handoff':ref('handoff'),'rehearsalList':arr(ref('rehearsalRef'))})
    defs['embeddedShow']=obj({**defs['show']['properties'],'songs':arr(ref('song'))},defs['show']['required'])
    defs['embeddedShow']['properties']['versions']=False
    defs['showVersion']=obj({'id':string,'label':string,'createdAt':string,'summary':string,'snapshot':ref('embeddedShow'),'missingAudio':arr(string)},['id','label','createdAt','summary','snapshot'])
    defs['show']['properties']['versions']=arr(ref('showVersion'))
    defs['manifest']=obj({'format':{'const':'stagebook-library'},'version':{'const':1},'workspace':obj({'showId':string,'songId':string},['showId','songId']),'shows':arr(obj({'id':string,'path':string},['id','path']))},['format','version','shows'])
    return {'$schema':'https://json-schema.org/draft/2020-12/schema','title':'Stagebook v1 files','oneOf':[ref('manifest'),ref('show'),ref('song')],'$defs':defs}
def main():
    out=ROOT/'dist';out.mkdir(exist_ok=True);data=json.loads((ROOT/'demo.json').read_text());sc=schema();(ROOT/'schema.json').write_text(json.dumps(sc,ensure_ascii=False,indent=2)+'\n')
    locales={lang:json.loads((ROOT/'src/locales'/f'{lang}.json').read_text()) for lang in ['en','zh-TW']}
    i18n=(ROOT/'src/i18n.js').read_text().replace('/*__LOCALES__*/{}',json.dumps(locales,ensure_ascii=False).replace('</','<\\/'))
    payload={'appVersion':(ROOT/'VERSION').read_text().strip(),'demo':data,'guide':(ROOT/'AI-GUIDE.md').read_text(),'entry':(ROOT/'AI-ENTRY.txt').read_text(),'schema':sc,'validator':(ROOT/'validate.py').read_text(),'readme':(ROOT/'使用说明.txt').read_text(),'readmes':{lang:(ROOT/'src/locales'/f'help.{lang}.txt').read_text() for lang in ['en','zh-TW']},'guides':{'en':(ROOT/'src/locales/ai-guide.en.md').read_text()}}
    html=(ROOT/'src/index.html').read_text().replace('/*__CSS__*/',(ROOT/'src/style.css').read_text()+'\n'+(ROOT/'src/design.css').read_text()).replace('/*__CORE__*/',i18n+'\n'+(ROOT/'src/core.js').read_text()).replace('/*__PAYLOAD__*/','const PAYLOAD='+json.dumps(payload,ensure_ascii=False).replace('</','<\\/')+';').replace('/*__APP__*/',('\n'.join((ROOT/'src'/name).read_text() for name in ['app.js','audio.js','human.js','timeline.js','editing.js','lyrics.js','rehearsal.js','appearance.js','io.js'])).replace('</script','<\\/script'))
    license_text=(ROOT/'LICENSE').read_text()
    assert '-->' not in license_text
    html=html.replace('</head>','\n<!-- Stagebook — SPDX-License-Identifier: GPL-3.0-only\nCorresponding source: Stagebook-v'+payload['appVersion']+'-source.zip, distributed alongside this app.\n'+license_text+'\n-->\n</head>',1)
    (out/'index.html').write_text(html);(out/'走台本.html').write_text(html);(out/'Stagebook.html').write_text(html)
    for name in ['AI-GUIDE.md','schema.json','validate.py','使用说明.txt','LICENSE']:shutil.copyfile(ROOT/name,out/name)
    (out/'AGENTS.md').write_text(payload['entry'])
    refs=[]
    for show in data['shows']:
        s=dict(show);s['songs']=[];base=out/'shows'/show['id'];base.mkdir(parents=True,exist_ok=True)
        for song in show['songs']:
            folder=base/'songs'/song['id'];folder.mkdir(parents=True,exist_ok=True);(folder/'song.json').write_text(json.dumps(song,ensure_ascii=False,indent=2)+'\n');s['songs'].append({'id':song['id'],'title':song['title'],'path':f"songs/{song['id']}/song.json"})
        (base/'show.json').write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n');refs.append({'id':show['id'],'path':f"shows/{show['id']}/show.json"})
    (out/'manifest.json').write_text(json.dumps({'format':'stagebook-library','version':1,'shows':refs},ensure_ascii=False,indent=2)+'\n')
    with zipfile.ZipFile(ROOT/'Stagebook-dev-bundle.zip','w',zipfile.ZIP_DEFLATED)as z:
        for p in out.rglob('*'):
            if p.is_file() and (str(p.relative_to(out)) in {'index.html','manifest.json','AI-GUIDE.md','AGENTS.md','schema.json','validate.py','使用说明.txt','LICENSE'} or p.relative_to(out).parts[0]=='shows'):z.write(p,'走台本/'+str(p.relative_to(out)))
    print('Built',out/'index.html',len(html.encode()),'bytes')
if __name__=='__main__':main()
