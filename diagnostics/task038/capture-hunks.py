"""Capture only the reviewed TASK038 implementation files against accepted main."""
import difflib, json, pathlib, subprocess
root=pathlib.Path(__file__).resolve().parents[2]
base='126563ccd1c2a9fcbb8e857eb81b422c02a55701'
files=['card-reports.js','app.js','content-packs.js','content/templates/content-packs.after.js','index.html','menu-navigation.js','session-restoration.js','setup-wizard.css','setup-wizard.js','sw.js','team-controller.js','team-engine.js','setup-view.js']
manifest=json.loads((root/'party-game/content/manifest.json').read_text())
labels=json.dumps({c['id']:c['name'] for c in manifest['categories']},ensure_ascii=False,separators=(',',':'))
generated='const QUIP_GENERAL_CATEGORY_LABELS=Object.freeze('+labels+');'
placeholder='const QUIP_GENERAL_CATEGORY_LABELS=Object.freeze(/* general-category-labels */{});'
hunks=[]
for name in files:
 old=subprocess.check_output(['git','show',base+':party-game/'+name],cwd=root).decode()
 new=(root/'party-game'/name).read_text().replace(generated,placeholder)
 if old==new: continue
 for context in [2,4,8,16]:
  groups=list(difflib.SequenceMatcher(None,old.splitlines(True),new.splitlines(True),autojunk=False).get_grouped_opcodes(context))
  items=[dict(file=name,before=''.join(old.splitlines(True)[g[0][1]:g[-1][2]]),after=''.join(new.splitlines(True)[g[0][3]:g[-1][4]])) for g in groups]
  if all(h['before'] and h['after'] and old.count(h['before'])==1 and new.count(h['after'])==1 for h in items):break
 else: raise RuntimeError('Nonunique reviewed context: '+name)
 hunks.extend(items)
(root/'diagnostics/task038/reviewed-hunks.json').write_text(json.dumps(hunks,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(files=sorted(set(h['file'] for h in hunks)),hunks=len(hunks))))
