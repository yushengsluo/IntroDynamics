import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const page = new URL('../../dist/apps/variational-equations/index.html', import.meta.url);
const html = fs.readFileSync(page, 'utf8');
const entry = html.match(/<script src="([^"]+)" defer><\/script>/);
assert.ok(entry); assert.doesNotMatch(html, /<script[^>]+type="module"/);
const loader = fs.readFileSync(new URL(entry[1], page), 'utf8');
for (const protocol of ['file:', 'http:', 'https:']) {
  const scripts = [], status = {textContent: ''};
  vm.runInNewContext(loader, {location: {protocol}, document: {
    createElement: () => ({}), body: {appendChild: script => scripts.push(script)},
    getElementById(id) {assert.equal(id, 'load-error'); return status;}
  }});
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, protocol === 'file:' ? 'js/app.bundle.js' : 'js/app.js');
  assert.equal(scripts[0].type, protocol === 'file:' ? undefined : 'module');
  assert.ok(fs.existsSync(new URL(scripts[0].src, page)));
  scripts[0].onerror(); assert.match(status.textContent, /could not load/);
}
const result = spawnSync(process.execPath, [fileURLToPath(new URL('interaction.test.mjs', import.meta.url))], {
  env: {...process.env, TEST_VARIATIONAL_BUNDLE: '1'}, encoding: 'utf8', timeout: 30000
});
assert.ifError(result.error); assert.equal(result.status, 0, result.stderr || result.stdout);
console.log('Passed: variational local-file loader and complete interactions using the standalone classic bundle.');
