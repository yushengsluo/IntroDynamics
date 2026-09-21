import assert from 'node:assert/strict';
import fs from 'node:fs';

const site=new URL('../dist/',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,site),'utf8');
const home=read('index.html');
const apps=fs.readdirSync(new URL('apps/',site),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
assert.ok(apps.includes('linear-flows')&&apps.includes('forced-oscillator'));
for(const name of apps){
 assert.ok(home.includes(`href="apps/${name}/index.html"`),`${name} is linked from the main page`);
 assert.match(read(`apps/${name}/index.html`),/href="\.\.\/\.\.\/index\.html"/,'App returns to the main page under HTTP and file URLs');
}
assert.match(read('dynamics.html'),/http-equiv="refresh" content="0; url=apps\/linear-flows\/index\.html"/,'Old app bookmarks continue to work');

for(const page of ['index.html','dynamics.html',...apps.map(name=>`apps/${name}/index.html`)]){
 for(const [,reference] of read(page).matchAll(/(?:href|src)="([^"]+)"/g)){
  if(/^(?:[a-z]+:|#)/i.test(reference))continue;
  assert.ok(!reference.startsWith('/'),'Use relative paths for direct Safari opening');
  const resource=new URL(reference,new URL(page,site));
  assert.ok(resource.href.startsWith(site.href),'Keep resources in the distributable folder');
  assert.ok(fs.existsSync(resource),`Missing resource ${reference} from ${page}`);
 }
}
for(const app of apps){
const modules=new URL(`apps/${app}/js/`,site);
for(const name of fs.readdirSync(modules).filter(name=>name.endsWith('.js'))){
 const source=fs.readFileSync(new URL(name,modules),'utf8');
 for(const [,dependency] of source.matchAll(/^import .+ from ['"]([^'"]+)['"]/gm)){
  assert.ok(fs.existsSync(new URL(dependency,new URL(name,modules))),`Missing import ${dependency} in ${name}`);
 }
}
}
assert.match(read('assets/images/linear-flows.svg'),/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
console.log('Passed: app navigation, old app link, local assets, and relocated module imports.');
