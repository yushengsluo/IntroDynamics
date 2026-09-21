import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Run out of process so an infinite drawing loop fails with a useful timeout.
for(const [width,height] of [[0,400],[900,0],[0,0]]){
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('./interaction.test.mjs',import.meta.url))],{
  env:{...process.env,TEST_CANVAS_WIDTH:String(width),TEST_CANVAS_HEIGHT:String(height)},
  encoding:'utf8',timeout:10000
 });
 assert.ifError(result.error);
 assert.equal(result.status,0,`${width}×${height}: ${result.stderr}`);
}
console.log('Passed: startup with zero-size canvases and interactions after restoring visible size.');
