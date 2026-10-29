const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
if(!fs.existsSync(path.join(root,'dist/index.html'))){console.error('请先运行 python3 build.py');process.exit(1);}
const tests=fs.readdirSync(path.join(root,'tests')).filter(name=>name.endsWith('.test.cjs')).sort();
let failed=0;
for(const name of tests){
 console.log('\n'+name);
 const result=spawnSync(process.execPath,[path.join(root,'tests',name)],{cwd:root,stdio:'inherit'});
 if(result.error){console.error(result.error.message);failed++;}
 else if(result.status!==0)failed++;
}
console.log('\n'+(tests.length-failed)+'/'+tests.length+' suites passed');
process.exitCode=failed?1:0;
