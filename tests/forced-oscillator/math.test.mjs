import assert from 'node:assert/strict';
import {createSolution,frequencyResponse,dampingRegime} from '../../dist/apps/forced-oscillator/js/oscillator.js';
const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance*Math.max(1,Math.abs(b)),`${a} ≠ ${b}`);
const fixtures=[
 [{b:0,k:4,omega:1},t=>[(Math.cos(t)-Math.cos(2*t))/3,(-Math.sin(t)+2*Math.sin(2*t))/3]],
 [{b:0,k:4,omega:2},t=>[t*Math.sin(2*t)/4,Math.sin(2*t)/4+t*Math.cos(2*t)/2]],
 [{b:4,k:4,omega:0},t=>[(1-(1+2*t)*Math.exp(-2*t))/4,t*Math.exp(-2*t)]],
 [{b:3,k:2,omega:0},t=>[.5-Math.exp(-t)+Math.exp(-2*t)/2,Math.exp(-t)-Math.exp(-2*t)]],
 [{b:1,k:2,omega:1,x0:.5,v0:.5},t=>[(Math.cos(t)+Math.sin(t))/2,(Math.cos(t)-Math.sin(t))/2]]
];
for(const [parameters,exact] of fixtures){
 const solution=createSolution(parameters);
 for(const t of [-10,-3,-.7,-.001,0,.001,.7,3,10,40,120]){const p=solution.at(t),expected=exact(t);close(p.x,expected[0]);close(p.v,expected[1]);close(p.force,Math.cos(parameters.omega*t));}
 const samples=solution.sample(40,1600);
 for(let i=0;i<samples.length;i+=37){const expected=exact(samples[i].t);close(samples[i].x,expected[0]);close(samples[i].v,expected[1]);}
 for(const [start,end] of [[-20,20],[-10,-2],[5,12],[-2.73,4.37]]){
  const window=solution.sampleInterval(start,end,321);
  assert.equal(window[0].t,start);assert.equal(window.at(-1).t,end);
  assert.ok(window.every((p,i)=>i===0||p.t>window[i-1].t));
  if(start<0&&end>0)assert.equal(window.filter(p=>p.t===0).length,1);
  for(const p of window){const expected=exact(p.t);close(p.x,expected[0],1e-8);close(p.v,expected[1],1e-8);}
 }
}
const periodic=createSolution({b:1,k:2,omega:1,x0:.5,v0:.5});
for(const p of periodic.sampleInterval(-120,120)){
 close(p.x,(Math.cos(p.t)+Math.sin(p.t))/2);close(p.v,(Math.cos(p.t)-Math.sin(p.t))/2);
}
const backwardGrowth=createSolution({b:10,k:.1,omega:0});
const extreme=backwardGrowth.sampleInterval(-120,20);
assert.equal(extreme[0].clipped,true);assert.equal(backwardGrowth.at(-120).clipped,true);
assert.deepEqual(extreme.find(p=>p.t===0),{t:0,x:0,v:0,force:1});
assert.ok(extreme.filter(p=>p.t>=0).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.v)),'Backward growth must not contaminate the forward solution');
assert.equal(createSolution({b:10,k:.1,omega:0,x0:10,v0:0}).at(-120).x,10,'Exact equilibrium has no backward transient');
for(const parameters of [{b:.4,k:1,omega:.8},{b:10,k:.1,omega:0},{b:0,k:25,omega:10},{b:1e-10,k:1,omega:1}]){
 const solution=createSolution({...parameters,x0:-20,v0:20}),samples=solution.sample(120);
 assert.deepEqual(solution.at(0),{t:0,x:-20,v:20,force:1});
 assert.equal(samples.at(-1).t,120);
 for(const p of samples)assert.ok([p.t,p.x,p.v,p.force].every(Number.isFinite));
 for(let i=0;i<samples.length;i+=113){const exact=solution.at(samples[i].t);close(samples[i].x,exact.x);close(samples[i].v,exact.v);}
 // Check the ODE independently by differentiating the evaluated velocity.
 const t=1.25,h=1e-5,p=solution.at(t);
 close((solution.at(t+h).v-solution.at(t-h).v)/(2*h),Math.cos(parameters.omega*t)-parameters.b*p.v-parameters.k*p.x,1e-6);
}
for(const center of [{b:0,k:1,omega:1},{b:2,k:1,omega:.8}]){
 const base=createSolution(center).at(30);
 for(const delta of [{b:center.b+1e-9},{omega:center.omega-1e-9},{omega:center.omega+1e-9}]){
  const nearby=createSolution({...center,...delta}).at(30);
  close(nearby.x,base.x,1e-6);close(nearby.v,base.v,1e-6);
 }
}
const resonance=createSolution({b:0,k:1,omega:1});
assert.equal(resonance.particular(5),null);assert.equal(resonance.response.amplitude,Infinity);assert.equal(resonance.response.phase,null);
close(frequencyResponse(1,2,1).amplitude,1/Math.sqrt(2));close(frequencyResponse(1,2,1).phase,Math.PI/4);
close(frequencyResponse(.4,2,0).amplitude,.5);assert.equal(frequencyResponse(.4,2,0).phase,0);
assert.equal(dampingRegime(0,1),'Undamped');assert.equal(dampingRegime(.4,1),'Underdamped');assert.equal(dampingRegime(2,1),'Critically damped');assert.equal(dampingRegime(4,1),'Overdamped');
for(const invalid of [{b:-1},{k:0},{omega:-1},{x0:Infinity},{v0:NaN}])assert.throws(()=>createSolution({b:.4,k:1,omega:.8,...invalid}),RangeError);
for(const t of [-501,501,NaN])assert.throws(()=>resonance.at(t),RangeError);
for(const end of [0,-1,501,NaN])assert.throws(()=>resonance.sample(end),RangeError);
for(const [start,end] of [[1,1],[5,2],[-501,20],[-20,501],[NaN,2],[0,NaN]])assert.throws(()=>resonance.sampleInterval(start,end),RangeError);
console.log('Passed: oscillator analytic solutions, ODE residuals, resonance continuity, finite samples, and input bounds.');

// The largest legal window and driving frequency must not exceed sample budgets.
const longWindow=createSolution({b:0,k:25,omega:10}).sampleInterval(-500,500);
assert.ok(longWindow.length<=20001);assert.equal(longWindow[0].t,-500);assert.equal(longWindow.at(-1).t,500);
assert.ok(longWindow.every(p=>!p.clipped&&Number.isFinite(p.x)&&Number.isFinite(p.v)));
for(const t of [-500,500]){
 close(resonance.at(t).x,t*Math.sin(t)/2,1e-8);
 close(resonance.at(t).v,(Math.sin(t)+t*Math.cos(t))/2,1e-8);
 close(periodic.at(t).x,(Math.cos(t)+Math.sin(t))/2);
}
assert.equal(backwardGrowth.at(-500).clipped,true);assert.ok(!backwardGrowth.at(500).clipped);
console.log('Passed: harmonic full ±500 interval, high-frequency sample budget, resonance, and periodic backward solution.');
