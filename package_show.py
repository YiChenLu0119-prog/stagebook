#!/usr/bin/env python3
"""Package existing JSON with the current offline app; never regex-edit JS source."""
import argparse,base64,json,pathlib,shutil,zipfile
ROOT=pathlib.Path(__file__).resolve().parent
def package(source,output,zip_path,neat=False,english=False):
    source=source.resolve();output=output.resolve()
    if source==output:raise ValueError('Use a separate output folder to preserve the source.')
    manifest=json.loads((source/'manifest.json').read_text())
    library={'version':1,'shows':[]}
    for entry in manifest['shows']:
        path=source/entry['path'];show=json.loads(path.read_text())
        show['songs']=[json.loads((path.parent/song['path']).read_text()) for song in show['songs']]
        library['shows'].append(show)
    html=(ROOT/'dist/index.html').read_text()
    snapshot=json.dumps(library,ensure_ascii=False).replace('<','\\u003c')
    data_root=' data-library-root="演出资料/"' if neat else ''
    html=html.replace('</head>','<script id="embedded-library"'+data_root+' type="application/json">'+snapshot+'</script></head>',1)
    audio={}
    for show in library['shows']:
        for song in show['songs']:
            if song.get('audio'):
                key=f"shows/{show['id']}/songs/{song['id']}/{song['audio']['file']}"
                if (source/key).is_file():audio[key]=base64.b64encode((source/key).read_bytes()).decode('ascii')
    if audio:html=html.replace('</head>','<script id="embedded-audio" type="application/json">'+json.dumps(audio)+'</script></head>',1)
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
    with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED)as archive:
        for path in output.rglob('*'):
            if path.is_file():archive.write(path,path.relative_to(output))
    with zipfile.ZipFile(zip_path)as archive:
        assert archive.testzip() is None
    return html
if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('source',type=pathlib.Path);args.add_argument('output',type=pathlib.Path);args.add_argument('zip',type=pathlib.Path);args.add_argument('--preview',type=pathlib.Path);args.add_argument('--neat',action='store_true');args.add_argument('--english',action='store_true')
    opts=args.parse_args();html=package(opts.source,opts.output,opts.zip,neat=opts.neat,english=opts.english)
    if opts.preview:opts.preview.write_text(html)
    print('Packaged',opts.zip)
