import assert from 'node:assert/strict';
import {representativeSeeds,evaluateRepresentative,trackedDirectionSeed} from '../../dist/apps/linear-flows/js/representatives.js';
import {matVec,expm} from '../../dist/apps/linear-flows/js/math.js';
import {matrixFromTraceDet} from '../../dist/apps/linear-flows/js/trace-determinant.js';
import {pointOnSlice} from '../../dist/apps/linear-flows/js/placement.js';

const cases=[
 [[1,.5],[0,-1]], [[-.6,.3],[0,-1.2]], [[-.35,-1.4],[1.4,-.35]],
 [[0,-1],[1,0]], [[0,1],[0,0]], [[-1,1],[0,-1]], [[0,0],[0,0]],
 [[.5,0,0],[0,-.6,0],[0,0,-1]], [[-.4,.2,0],[0,-.8,.2],[0,0,-1.2]],
 [[-.25,-1.4,0],[1.4,-.25,0],[0,0,-.55]], [[0,-1,0],[1,0,0],[0,0,0]],
 [[0,1,0],[0,0,1],[0,0,0]], [[2,0,0],[0,2,0],[0,0,-1]],
 [[0,1],[1e-16,0]], [[1,-20],[.05,1]],
];
for(const A of cases){
 const seeds=representativeSeeds(A);
 assert.ok(seeds.length>=2&&seeds.length<=27);
 assert.ok(seeds[0].x.every(v=>v===0));
 for(const seed of seeds)for(const t of [-1,0,1]){
  const expected=matVec(expm(A,t),seed.x),actual=evaluateRepresentative(seed,t)??expected;
  assert.ok(Math.hypot(...actual.map((v,i)=>v-expected[i]))<1e-7,`Incorrect mode: ${seed.label}`);
 }
}
const saddle=representativeSeeds([[1,0],[0,-2]]);
assert.equal(saddle.length,9);
assert.equal(saddle.filter(s=>s.label.startsWith('Stable direction')).length,2);
assert.equal(saddle.filter(s=>s.label.startsWith('Unstable direction')).length,2);
assert.equal(saddle.filter(s=>s.components.length===2).length,4);
for(const seed of saddle.filter(s=>s.label.startsWith('Stable direction'))){
 const x=evaluateRepresentative(seed,50);assert.equal(x[0],0);assert.ok(Math.abs(x[1])<1e-40);
}
assert.equal(representativeSeeds([[1,0,0],[0,-1,0],[0,0,0]]).length,27);
const jordan=representativeSeeds([[0,1,0],[0,0,1],[0,0,0]]);
assert.ok(jordan.some(s=>s.label.startsWith('Linear drift')));
assert.ok(jordan.some(s=>s.label.startsWith('Quadratic drift')));
assert.ok(jordan.some(s=>s.label.startsWith('Equilibrium direction')));

// A persistent pair follows the stable saddle direction, including highly tilted
// eigenspaces where using the full exponential would leak into the unstable mode.
for(const A of [...cases.filter(A=>A.length===2),[[7,8],[6,-5]],matrixFromTraceDet(35,-99)]){
 const positive=trackedDirectionSeed(A),negative=trackedDirectionSeed(A,1.5,-1);
 assert.ok(Math.hypot(...positive.x.map((v,i)=>v+negative.x[i]))<1e-12);
 assert.ok(Math.abs(Math.hypot(...positive.x)-1.5)<1e-12);
 if(!positive.components)continue;
 const lambda=positive.components[0].a,Ax=matVec(A,positive.x);
 assert.ok(Math.hypot(...Ax.map((v,i)=>v-lambda*positive.x[i]))<1e-10);
 const actual=evaluateRepresentative(positive,.2),expected=matVec(expm(A,.2),positive.x);
 assert.ok(Math.hypot(...actual.map((v,i)=>v-expected[i]))<1e-9);
 if(lambda<0){
  const later=evaluateRepresentative(positive,100);
  assert.ok(later.every(Number.isFinite));
  assert.ok(Math.hypot(...later)<1.5,'Stable samples continue to decay instead of veering outward');
 }
}
// The same two slots pass continuously through repeated eigenvalues and det = 0.
for(const [trace,det] of [[2,1],[-2,1],[0,0],[2,0],[-2,0]]){
 let previous=null,previousValue=null;
 for(const offset of [-1e-12,0,1e-12]){
  const A=matrixFromTraceDet(trace,det+offset),sample=trackedDirectionSeed(A,1.5,1,previous?.x);
  const value=evaluateRepresentative(sample,.5)??matVec(expm(A,.5),sample.x);
  if(previous){
   assert.ok(Math.hypot(...sample.x.map((v,i)=>v-previous.x[i]))<1e-5,'Tracked initial points are continuous at boundaries');
   assert.ok(Math.hypot(...value.map((v,i)=>v-previousValue[i]))<1e-5,'Tracked trajectories are continuous at boundaries');
  }
  previous=sample;previousValue=value;
 }
}

// Recover a point from its projection on each selected coordinate plane.
for(const yaw of [.3,.65,1.2])for(const pitch of [.4,.8,-.5]){
 const point=[2,-3,4],c=Math.cos(yaw),s=Math.sin(yaw),p=Math.sin(pitch),q=Math.cos(pitch);
 const u=c*point[0]-s*point[1],v=p*(s*point[0]+c*point[1])+q*point[2];
 for(let axis=0;axis<3;axis++){
  const recovered=pointOnSlice(u,v,yaw,pitch,axis,point[axis]);
  assert.ok(recovered);assert.ok(Math.hypot(...recovered.map((x,i)=>x-point[i]))<1e-10);
 }
}
assert.equal(pointOnSlice(1,2,.65,0,2,0),null);
assert.equal(pointOnSlice(1,2,0,.5,0,0),null);
assert.equal(pointOnSlice(1,2,Math.PI/2,.5,1,0),null);
console.log('Passed: representative families, invariant-mode accuracy, saddle separatrices, Jordan drift, and 3D slice picking.');
