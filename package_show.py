#!/usr/bin/env python3
"""Package existing JSON with the current offline app; never regex-edit JS source."""
import argparse,base64,json,pathlib,shutil,zipfile,re,hashlib
ROOT=pathlib.Path(__file__).resolve().parent
def package(source,output,zip_path,neat=False,english=False,source_archive=None,linked_assets=False):
    source=source.resolve();output=output.resolve()
    if source==output:raise ValueError('Use a separate output folder to preserve the source.')
    manifest=json.loads((source/'manifest.json').read_text())
    library={'version':1,'shows':[]}
    if manifest.get('workspace'):library['workspace']=manifest['workspace']
    for entry in manifest['shows']:
        path=source/entry['path'];show=json.loads(path.read_text())
        show['songs']=[json.loads((path.parent/song['path']).read_text()) for song in show['songs']]
        library['shows'].append(show)
    html=(ROOT/'dist/index.html').read_text()
    if english:html=html.replace('<html lang="zh-CN">','<html lang="en" data-ui-language="en">',1)
    else:html=html.replace('<html lang="zh-CN">','<html lang="zh-CN" data-ui-language="zh-CN">',1)
    snapshot=json.dumps(library,ensure_ascii=False).replace('<','\\u003c')
    data_root=' data-library-root="演出资料/"' if neat else ''
    html=html.replace('</head>','<script id="embedded-library"'+data_root+' type="application/json">'+snapshot+'</script></head>',1)
    audio={};media={}
    for show in library['shows']:
        for song in [q for production in [show]+[v['snapshot'] for v in show.get('versions',[])] for q in production['songs']]:
            if song.get('audio'):
                key=f"shows/{show['id']}/songs/{song['id']}/{song['audio']['file']}"
                if (source/key).is_file():audio[key]=base64.b64encode((source/key).read_bytes()).decode('ascii')
    for show in library['shows']:
        for production in [show]+[v['snapshot'] for v in show.get('versions',[])]:
            for song in production['songs']:
                for cue in song['cues']:
                    for a in cue.get('attachments',[]):
                        key=f"shows/{show['id']}/songs/{song['id']}/{a['file']}"
                        if (source/key).is_file():media[key]={'type':a['mimeType'],'base64':base64.b64encode((source/key).read_bytes()).decode('ascii')}
    linked_files={}
    if linked_assets:
        asset_index={}
        for key,item in {**{k:{'mimeType':'audio/mpeg','base64':v} for k,v in audio.items()},**{k:{'mimeType':v['type'],'base64':v['base64']} for k,v in media.items()}}.items():
            relative='技术资料/local-media/'+hashlib.sha256(key.encode()).hexdigest()[:24]+'.js'
            asset_index[key]={'file':relative,'mimeType':item['mimeType']}
            linked_files[relative]='globalThis.StagebookLocalAssets=globalThis.StagebookLocalAssets||Object.create(null);globalThis.StagebookLocalAssets['+json.dumps(key)+']='+json.dumps(item).replace('<','\\u003c')+';\n'
        if asset_index:html=html.replace('</head>','<script id="embedded-asset-index" type="application/json">'+json.dumps(asset_index).replace('<','\\u003c')+'</script></head>',1)
    else:
        if media:html=html.replace('</head>','<script id="embedded-media" type="application/json">'+json.dumps(media).replace('<','\\u003c')+'</script></head>',1)
        if audio:html=html.replace('</head>','<script id="embedded-audio" type="application/json">'+json.dumps(audio).replace('<','\\u003c')+'</script></head>',1)
    if source_archive:
        source_archive=pathlib.Path(source_archive)
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*-source\.zip',source_archive.name):raise ValueError('Invalid corresponding source archive name.')
        capsule={'name':source_archive.name,'base64':base64.b64encode(source_archive.read_bytes()).decode('ascii')}
        html=html.replace('</head>','<script id="embedded-source" type="application/json">'+json.dumps(capsule)+'</script></head>',1)
    if neat:
        if output.exists() and any(output.iterdir()):raise ValueError('Use a new empty folder for a clean package.')
        output.mkdir(parents=True,exist_ok=True)
        data=output/'演出资料';data.mkdir(exist_ok=True)
        shutil.copyfile(source/'manifest.json',data/'manifest.json')
        shutil.copytree(source/'shows',data/'shows',dirs_exist_ok=True)
        (output/('Stagebook.html' if english else '走台本.html')).write_text(html)
        technical=data/'技术资料';technical.mkdir(exist_ok=True)
        for name in ['AI-GUIDE.md','AGENTS.md','schema.json','validate.py','LICENSE']:
            shutil.copyfile(ROOT/'dist'/name,technical/name)
    else:
        shutil.copytree(source,output,dirs_exist_ok=True)
        (output/'index.html').write_text(html)
        (output/('Stagebook.html' if english else '走台本.html')).write_text(html)
        for name in ['AI-GUIDE.md','AGENTS.md','schema.json','validate.py','使用说明.txt','LICENSE']:
            shutil.copyfile(ROOT/'dist'/name,output/name)
    if source_archive:shutil.copyfile(source_archive,(output/'演出资料/技术资料' if neat else output)/source_archive.name)
    for relative,script in linked_files.items():
        target=(output/'演出资料' if neat else output)/relative
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text(script)
    with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED)as archive:
        for path in output.rglob('*'):
            if path.is_file():archive.write(path,path.relative_to(output))
    with zipfile.ZipFile(zip_path)as archive:
        assert archive.testzip() is None
    return html
if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('source',type=pathlib.Path);args.add_argument('output',type=pathlib.Path);args.add_argument('zip',type=pathlib.Path);args.add_argument('--preview',type=pathlib.Path);args.add_argument('--neat',action='store_true');args.add_argument('--english',action='store_true');args.add_argument('--source-archive',type=pathlib.Path);args.add_argument('--linked-assets',action='store_true')
    opts=args.parse_args();html=package(opts.source,opts.output,opts.zip,neat=opts.neat,english=opts.english,source_archive=opts.source_archive,linked_assets=opts.linked_assets)
    if opts.preview:opts.preview.write_text(html)
    print('Packaged',opts.zip)
