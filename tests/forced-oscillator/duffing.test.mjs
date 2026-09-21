import assert from 'node:assert/strict';
import {createDuffingSolution,potential} from '../../dist/apps/forced-oscillator/js/duffing.js';
import {createSolution} from '../../dist/apps/forced-oscillator/js/oscillator.js';

const close=(actual,expected,tolerance=2e-6)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} ≠ ${expected}`);
// cos³(t) = (3 cos(t) + cos(3t))/4 gives genuinely nonlinear exact fixtures.
for(const [parameters,sign,end] of [
 [{b:0,k:-2,beta:4,omega:3,x0:1,v0:0},1,6],
 [{b:0,k:4,beta:-4,omega:3,x0:-1,v0:0},-1,2]
]){
 const solution=createDuffingSolution(parameters),points=solution.sampleInterval(-end,end);
 assert.equal(points[0].t,-end);assert.equal(points.at(-1).t,end);
 assert.equal(points.filter(p=>p.t===0).length,1);
 for(const t of [-end,-.753,-.01,0,.323,1.777,end]){
  const p=solution.at(t);close(p.x,sign*Math.cos(t));close(p.v,-sign*Math.sin(t));
 }
 for(let i=0;i<points.length;i+=31){close(points[i].x,sign*Math.cos(points[i].t));close(points[i].v,-sign*Math.sin(points[i].t));}
 assert.deepEqual(solution.limits(),[]);
}
const equilibrium=createDuffingSolution({b:3,k:-1,beta:2,omega:0,x0:1,v0:0});
for(const p of equilibrium.sampleInterval(-120,120)){assert.equal(p.x,1);assert.equal(p.v,0);}
for(const parameters of [{b:.4,k:1,omega:.8,x0:-2,v0:1},{b:0,k:1,omega:1,x0:0,v0:0}]){
 const linear=createSolution(parameters),limit=createDuffingSolution({...parameters,beta:0});
 for(const t of [-20,-3,0,1,20,120])assert.deepEqual(limit.at(t),linear.at(t));
 const nearby=createDuffingSolution({...parameters,beta:1e-8});
 for(const t of [-2,.4,2]){close(nearby.at(t).x,linear.at(t).x);close(nearby.at(t).v,linear.at(t).v);}
}
// The general linear limit also allows k = 0 and negative k in Duffing mode.
const free=createDuffingSolution({b:0,k:0,beta:0,omega:0,x0:2,v0:-3});
for(const t of [-5,0,7]){close(free.at(t).x,2-3*t+t*t/2);close(free.at(t).v,-3+t);}
const inverted=createDuffingSolution({b:0,k:-1,beta:0,omega:0});
for(const t of [-4,0,4]){close(inverted.at(t).x,Math.cosh(t)-1);close(inverted.at(t).v,Math.sinh(t));}
const driven=createDuffingSolution({b:.25,k:-1,beta:1,omega:1.2,x0:.5,v0:-.3});
driven.sampleInterval(-3,12);
const E=p=>p.v*p.v/2+potential(-1,1,p.x);
for(const t of [-1.73,.541,2.379]){
 const h=1e-4,p=driven.at(t),before=driven.at(t-h),after=driven.at(t+h);
 close((after.x-before.x)/(2*h),p.v,2e-5);
 close((E(after)-E(before))/(2*h),p.v*p.force-.25*p.v*p.v,2e-5);
}
const escape=createDuffingSolution({b:.1,k:1,beta:-1,omega:1,x0:4,v0:2});
const escaping=escape.sampleInterval(-120,120);
assert.ok(escape.limits().length>0);assert.ok(escaping.length<200003,'Computation remains bounded');
assert.equal(escape.at(120).clipped,true);assert.equal(escape.at(-120).clipped,true);
assert.deepEqual(escape.at(0),{t:0,x:4,v:2,force:1});
assert.ok(escaping.every(p=>p.clipped||[p.x,p.v,p.force].every(Number.isFinite)));
const damping=createDuffingSolution({b:10,k:1,beta:1,omega:1});
const mixed=damping.sampleInterval(-120,10);
assert.ok(mixed.some(p=>p.t<0&&p.clipped));assert.ok(mixed.filter(p=>p.t>=0).every(p=>!p.clipped),'Failed backward integration must not spoil forward states');
for(const [start,end] of [[-3,-1],[1,3]]){
 const points=driven.sampleInterval(start,end,100);
 assert.equal(points[0].t,start);assert.equal(points.at(-1).t,end);assert.ok(points.every((p,i)=>!i||p.t>points[i-1].t));
}
for(const invalid of [{b:-1},{beta:NaN},{k:Infinity},{omega:-1},{x0:NaN}])assert.throws(()=>createDuffingSolution({b:.3,k:1,beta:1,omega:1,...invalid}),RangeError);
assert.throws(()=>driven.at(-501),RangeError);assert.throws(()=>driven.sampleInterval(2,1),RangeError);
console.log('Passed: exact Duffing solutions, signed time, harmonic limit, energy balance, interpolation, and bounded escape handling.');

// Exact equilibrium remains usable over the entire signed window.
for(const p of equilibrium.sampleInterval(-500,500)){assert.equal(p.x,1);assert.equal(p.v,0);}
const chaosParameters={b:.3,k:-1,beta:.25,omega:1.2,x0:2.6,v0:0};
const chaotic=createDuffingSolution(chaosParameters),nearbyChaos=createDuffingSolution({...chaosParameters,x0:2.60001});
const chaosPoints=chaotic.sampleInterval(0,500);
nearbyChaos.sampleInterval(0,500);
assert.deepEqual(chaotic.limits(),[]);assert.deepEqual(nearbyChaos.limits(),[]);
assert.equal(chaosPoints.at(-1).t,500);assert.ok(chaosPoints.every(p=>!p.clipped&&Math.abs(p.x)<4&&Math.abs(p.v)<3));
assert.ok(chaosPoints.some(p=>p.t>50&&p.x<-2)&&chaosPoints.some(p=>p.t>50&&p.x>2),'Chaotic example visits both wells after the transient');
assert.ok([100,150,200,250].some(t=>Math.abs(chaotic.at(t).x-nearbyChaos.at(t).x)>.1),'Nearby seeds separate, without asserting a numerically unstable long-time endpoint');
const signed=chaotic.sampleInterval(-500,500);
assert.ok(chaotic.limits().some(limit=>limit.direction===-1));
assert.ok(signed.length<200003);assert.equal(signed[0].clipped,true);
assert.ok(signed.filter(p=>p.t>=0).every(p=>!p.clipped),'Failed backward integration preserves the forward chaotic path');
assert.deepEqual(chaotic.at(0),{t:0,x:2.6,v:0,force:1});
assert.throws(()=>chaotic.at(501),RangeError);
console.log('Passed: Duffing ±500 limits, bounded long chaotic paths, sensitivity, and independent backward truncation.');
