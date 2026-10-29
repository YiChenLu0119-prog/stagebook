#!/usr/bin/env python3
"""Validate an offline Stagebook library. Python 3.9+, standard library only."""
import argparse, json, math, pathlib, re, sys

def point(p):
    return isinstance(p, dict) and all(isinstance(p.get(k), (int,float)) and not isinstance(p.get(k),bool) and math.isfinite(p[k]) for k in ('x','y'))
def flatten(points, close=False):
    if not points or not all(point(p) for p in points): return []
    out=[points[0]]
    for a,b in zip(points, points[1:]):
        curved=point(b.get('c1')) and point(b.get('c2'))
        n=40 if curved else max(1,math.ceil(math.hypot(b['x']-a['x'], b['y']-a['y'])/2))
        for i in range(1,n+1):
            t=i/n;u=1-t
            out.append({k:u**3*a[k]+3*u*u*t*b['c1'][k]+3*u*t*t*b['c2'][k]+t**3*b[k] if curved else a[k]+(b[k]-a[k])*t for k in ('x','y')})
    if close:out.append(points[0])
    return out
def inside(p,poly):
    if not point(p) or len(poly)<3:return False
    hit=False
    for a,b in zip(poly,poly[1:]+poly[:1]):
        dist=lambda x,y:math.hypot(x['x']-y['x'],x['y']-y['y'])
        if abs(dist(a,p)+dist(p,b)-dist(a,b))<.02:return True
        if (a['y']>p['y'])!=(b['y']>p['y']) and p['x']<(b['x']-a['x'])*(p['y']-a['y'])/(b['y']-a['y'])+a['x']:hit=not hit
    return hit
def crosses(a,b,c,d):
    rx=b['x']-a['x'];ry=b['y']-a['y'];sx=d['x']-c['x'];sy=d['y']-c['y'];den=rx*sy-ry*sx
    if abs(den)<1e-9:return False
    t=((c['x']-a['x'])*sy-(c['y']-a['y'])*sx)/den;u=((c['x']-a['x'])*ry-(c['y']-a['y'])*rx)/den
    return -1e-8<=t<=1+1e-8 and 1e-8<u<1-1e-8
def numeric(x):return isinstance(x,(float,int)) and not isinstance(x,bool) and math.isfinite(x)
def safe_path(s):return isinstance(s,str) and s and not s.startswith('/') and '\\' not in s and not any(p in ('','..','.') for p in s.split('/')) and not re.match(r'^[A-Za-z]+:',s)

def validate(root):
    root=pathlib.Path(root).resolve();findings=[];summary=[]
    if not (root/'manifest.json').exists() and (root/'演出资料'/'manifest.json').exists():root=root/'演出资料'
    def add(level,location,message):findings.append(dict(level=level,location=location,message=message))
    def read(rel):
        if not safe_path(rel):raise ValueError('Unsafe relative path: '+str(rel))
        file=(root/rel).resolve()
        if not file.is_relative_to(root):raise ValueError('Path leaves the library: '+rel)
        return json.loads(file.read_text(encoding='utf-8'))
    manifest=read('manifest.json')
    if manifest.get('version')!=1 or manifest.get('format')!='stagebook-library':raise ValueError('Unsupported manifest/version')
    if not manifest.get('shows'):raise ValueError('The library must have at least one show')
    show_ids=set()
    for entry in manifest['shows']:
        s=read(entry['path']);stage=s['stage'];base=str(pathlib.PurePosixPath(entry['path']).parent)
        if not s.get('songs'):raise ValueError('Each show must have at least one song')
        if s['id']!=entry['id'] or s['id'] in show_ids:add('error',entry['path'],'Show ID mismatch/duplicate')
        if 'pauseAtSteps' in s and not isinstance(s['pauseAtSteps'],bool):add('error',entry['path'],'pauseAtSteps must be a boolean')
        show_ids.add(s['id']);all_objects=s['actors']+s['props'];ids={o['id'] for o in all_objects}
        if len(ids)!=len(all_objects):add('error',entry['path'],'Duplicate actor / prop IDs')
        if len(stage.get('boundary',[]))<3 or not all(point(p) for p in stage['boundary']):add('error',entry['path'],'Invalid stage boundary');continue
        polygon=flatten(stage['boundary'],True);zones=[flatten(z['points'],True) for z in stage.get('backstage',[])];walls=[flatten(w['points']) for w in stage.get('walls',[])];gates={a['id'] for a in stage.get('anchors',[])}
        allowed=lambda p:inside(p,polygon) or any(inside(p,z) for z in zones)
        song_ids=set()
        for ref in s['songs']:
            rel=base+'/'+ref['path'];q=read(rel);loc=lambda id:rel+'#'+str(id)
            if q['id'] in song_ids:add('error',rel,'Duplicate song ID')
            song_ids.add(q['id']);cast=q.get('castIds',[])+q.get('propIds',[]);initial=q.get('initial',{})
            if q.get('mode') not in ('steps','timed'):add('error',rel,'Mode must be steps or timed')
            for obj in cast:
                if obj not in ids:add('error',loc(obj),'Unknown actor / prop')
                if not point(initial.get(obj)):add('error',loc(obj),'Missing or invalid initial position')
                elif not allowed(initial[obj]):add('error',loc(obj),'Initial position is outside stage/backstage')
            events=[];cursor=0;seen=set()
            for c in q.get('cues',[]):
                dur=c.get('duration');at=cursor if q.get('mode')=='steps' else c.get('at')
                if not numeric(dur) or dur<0 or not numeric(at) or at<0:add('error',loc(c.get('id')),'Invalid cue timing');continue
                cursor+=dur
                if c.get('id') in seen:add('error',loc(c.get('id')),'Duplicate cue ID')
                seen.add(c.get('id'));events.append((at,at+dur,c))
            move_events=[];spans={};positions=dict(initial)
            for start,end,c in sorted(events,key=lambda x:x[0]):
                for m in c.get('moves',[]):
                    mid=m.get('id');obj=m.get('entityId');pts=m.get('points',[])
                    if mid in seen:add('error',loc(mid),'Duplicate move ID')
                    seen.add(mid)
                    if obj not in cast:add('error',loc(mid),'Move references an object absent from this song')
                    if len(pts)<2 or not all(point(p) for p in pts) or any(('c1'in p)!=('c2'in p) or ('c1'in p and not(point(p['c1']) and point(p['c2']))) for p in pts):add('error',loc(mid),'Invalid route coordinates or curve controls');continue
                    line=flatten(pts)
                    if not all(allowed(p) for p in line):add('error',loc(mid),'Route leaves stage/backstage')
                    if any(crosses(a,b,u,v) for a,b in zip(line,line[1:]) for wall in walls for u,v in zip(wall,wall[1:])):add('error',loc(mid),'Route crosses a wall')
                    if m.get('gateId') and m['gateId'] not in gates:add('error',loc(mid),'Unknown gate reference')
                    offset=m.get('startOffset',0);move_duration=m.get('duration',end-start)
                    if not numeric(offset) or offset<0 or not numeric(move_duration) or move_duration<0:
                        add('error',loc(mid),'Move startOffset and duration must be non-negative seconds');continue
                    move_events.append((start+offset,start+offset+move_duration,m))
            for start,end,m in sorted(move_events,key=lambda x:x[0]):
                obj=m['entityId'];mid=m['id'];pts=m['points']
                if any(start<e-1e-6 and end>b+1e-6 for b,e in spans.get(obj,[])):add('error',loc(mid),'Overlapping moves for the same object')
                before=positions.get(obj)
                if before and math.hypot(before['x']-pts[0]['x'],before['y']-pts[0]['y'])>.15:add('warning',loc(mid),'Route starts away from the preceding position; playback will jump')
                positions[obj]=pts[-1];spans.setdefault(obj,[]).append((start,end))
            for l in q.get('lyrics',[]):
                if not numeric(l.get('start')) or not numeric(l.get('end')) or l['start']<0 or l['end']<l['start']:add('error',loc(l.get('id')),'Invalid lyric times')
            for n in q.get('annotations',[]):
                start=n.get('start');end=n.get('end')
                if (start is not None and (not numeric(start) or start<0)) or (end is not None and (not numeric(end) or end<0)) or (numeric(start) and numeric(end) and end<start):add('error',loc(n.get('id')),'Invalid annotation time range')
                for obj in n.get('entityIds',[]):
                    if obj not in ids:add('error',loc(n.get('id')),'Annotation references an unknown object: '+obj)
            audio=q.get('audio')
            if audio:
                path=audio.get('file')
                if not safe_path(path):add('error',rel,'Invalid audio relative path')
                elif not (root/pathlib.PurePosixPath(rel).parent/path).exists():add('warning',rel,'Referenced MP3 is missing; silent rehearsal remains available')
            summary.append(dict(show=s.get('title'),song=q.get('title'),cues=len(q.get('cues',[])),actors=len(q.get('castIds',[])),props=len(q.get('propIds',[]))))
    return dict(valid=not any(x['level']=='error' for x in findings),shows=len(show_ids),songs=len(summary),summary=summary,findings=findings)

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('library');ap.add_argument('--json',action='store_true');args=ap.parse_args()
    try:result=validate(args.library)
    except (OSError,ValueError,KeyError,TypeError) as error:
        if args.json:print(json.dumps(dict(valid=False,error=str(error)),ensure_ascii=False))
        else:print('Could not read library:',error,file=sys.stderr)
        return 2
    if args.json:print(json.dumps(result,ensure_ascii=False,indent=2))
    else:
        print(f"{result['shows']} shows / {result['songs']} songs — {'PASS' if result['valid'] else 'ERRORS'}")
        for f in result['findings']:print(f"[{f['level']}] {f['location']}: {f['message']}")
    return 0 if result['valid'] else 1
if __name__=='__main__':sys.exit(main())
