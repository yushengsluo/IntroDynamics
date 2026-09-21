import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const appPage=new URL('../../dist/apps/linear-flows/index.html',import.meta.url);
const html=fs.readFileSync(appPage,'utf8');
const entry=html.match(/<script src="([^"]+)" defer><\/script>/);
assert.ok(entry,'HTML starts with a classic script that works under file://');
assert.doesNotMatch(html,/<script[^>]+type="module"/,'Do not request modules directly under file://');
const loader=fs.readFileSync(new URL(entry[1],appPage),'utf8');
for(const protocol of ['file:','http:','https:']){
 const scripts=[],status={textContent:''};
 vm.runInNewContext(loader,{location:{protocol},document:{
  createElement(tag){assert.equal(tag,'script');return {};},
  body:{appendChild(script){scripts.push(script);}},
  getElementById(id){assert.equal(id,'placement-status');return status;}
 }});
 assert.equal(scripts.length,1,'Load exactly one copy of the app');
 assert.equal(scripts[0].src,protocol==='file:'?'js/app.bundle.js':'js/app.js');
 assert.equal(scripts[0].type,protocol==='file:'?undefined:'module');
 assert.ok(fs.existsSync(new URL(scripts[0].src,appPage)));
 scripts[0].onerror();assert.match(status.textContent,/could not load/);
}

const freshness=spawnSync('python3',[fileURLToPath(new URL('../../scripts/build_file_bundle.py',import.meta.url)),'--check'],{encoding:'utf8',timeout:10000});
assert.ifError(freshness.error);assert.equal(freshness.status,0,freshness.stderr);
const classic=spawnSync(process.execPath,[fileURLToPath(new URL('./interaction.test.mjs',import.meta.url))],{
 env:{...process.env,TEST_APP_BUNDLE:'1'},encoding:'utf8',timeout:10000
});
assert.ifError(classic.error);assert.equal(classic.status,0,classic.stderr);
console.log('Passed: local-file loader, current bundle, and full app interactions with the classic script.');
