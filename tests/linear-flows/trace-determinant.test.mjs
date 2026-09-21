import assert from 'node:assert/strict';
import {matrixFromTraceDet,tracePlot,tracePoint,defaultTraceBounds,fitTraceBounds} from '../../dist/apps/linear-flows/js/trace-determinant.js';
import {trace,determinant,analyze} from '../../dist/apps/linear-flows/js/math.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
for(const [t,d,title] of [[-3,2,'Stable node'],[3,2,'Unstable node'],[-1,2,'Stable spiral'],[1,2,'Unstable spiral'],[0,4,'Center / rotation'],[0,-1,'Saddle'],[-2,1,'Stable node'],[2,1,'Unstable node'],[-2,0,'Stable equilibrium set'],[0,0,'Shear / degenerate']]){
 const A=matrixFromTraceDet(t,d);close(trace(A),t);close(determinant(A),d);assert.equal(analyze(A).title,title);
}
for(let t=-40;t<=40;t+=2)for(let i=0;i<=20;i++){
 const min=20*Math.abs(t)-800,max=t*t/4+400,d=min+(max-min)*i/20,A=matrixFromTraceDet(t,d);
 assert.ok(A.flat().every(v=>Number.isFinite(v)&&Math.abs(v)<=20));close(trace(A),t);close(determinant(A),d);
}
assert.equal(matrixFromTraceDet(41,0),null);assert.equal(matrixFromTraceDet(0,401),null);assert.equal(matrixFromTraceDet(0,-801),null);assert.equal(matrixFromTraceDet(NaN,0),null);
const before=matrixFromTraceDet(2,1-1e-7),after=matrixFromTraceDet(2,1+1e-7);
assert.ok(before.flat().every((v,i)=>Math.abs(v-after.flat()[i])<1e-6),'The representative matrix changes continuously across the parabola');
const bounds=defaultTraceBounds();
for(const [w,h] of [[300,300],[900,400]])for(const [t,d] of [[-3,2],[3,2],[0,4],[0,-1],[2,1],[-6,-6],[6,10]]){
 const p=tracePlot(w,h,bounds).project(t,d),point=tracePoint(...p,w,h,bounds,{snap:false});close(point.t,t);close(point.d,d);
}
const plot=tracePlot(300,300,bounds),onCenter=plot.project(0,4),nearCenter=tracePoint(onCenter[0]+2,onCenter[1],300,300,bounds);
assert.equal(nearCenter.t,0);close(nearCenter.d,4);
assert.equal(tracePoint(0,0,300,300,bounds),null);
assert.equal(tracePoint(0,0,0,0,bounds),null);
const fit=fitTraceBounds(bounds,40,800);assert.ok(fit.tMax>=40&&fit.dMax>=800);assert.deepEqual(bounds,defaultTraceBounds());
console.log('Passed: trace–determinant mapping, classification, boundaries, bounded matrices, and coordinate picking.');
