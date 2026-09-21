import {createSolution} from './oscillator.js';

export const DUFFING_STATE_LIMIT=1e6;
const MAX_STEPS=100000,MAX_STEP=.025,MIN_STEP=1e-9;
const validTime=t=>Number.isFinite(t)&&t>=-500&&t<=500;

export function potential(k,beta,x){return .5*k*x*x+(beta===0?0:.25*beta*x**4);}

export function createDuffingSolution({b,k,beta=1,omega,x0=0,v0=0}){
 if(![b,k,beta,omega,x0,v0].every(Number.isFinite)||b<0||omega<0)throw new RangeError('Use finite coefficients and initial values, with b ≥ 0 and ω ≥ 0.');
 const regime=beta===0?'Linear limit':beta>0?(k<0?'Double well':'Hardening spring'):(k>0?'Softening spring':'Inverted potential');
 // Preserve the exact harmonic solution when the cubic term is switched off.
 if(beta===0&&k>0)return {...createSolution({b,k,omega,x0,v0}),regime,limits:()=>[]};
 const acceleration=(t,x,v)=>Math.cos(omega*t)-b*v-k*x-beta*x*x*x;
 const bounded=y=>y.every(value=>Number.isFinite(value)&&Math.abs(value)<=DUFFING_STATE_LIMIT);
 const point=(t,x,v)=>({t,x,v,force:Math.cos(omega*t)});
 const clipped=t=>({...point(t,null,null),clipped:true});
 const knot=(t,y)=>({t,x:y[0],v:y[1],a:acceleration(t,...y)});
 const branch=direction=>({direction,u:0,h:.01,attempts:0,knots:[knot(0,[x0,v0])],failure:null});
 const forward=branch(1),backward=branch(-1);
 function rk4(t,y,h){
  const a1=acceleration(t,...y),v2=y[1]+h*a1/2,x2=y[0]+h*y[1]/2;
  const a2=acceleration(t+h/2,x2,v2),v3=y[1]+h*a2/2,x3=y[0]+h*v2/2;
  const a3=acceleration(t+h/2,x3,v3),v4=y[1]+h*a3,x4=y[0]+h*v3;
  const a4=acceleration(t+h,x4,v4);
  return [y[0]+h*(y[1]+2*v2+2*v3+v4)/6,y[1]+h*(a1+2*a2+2*a3+a4)/6];
 }
 function ensure(path,target){
  while(path.u<target&&!path.failure){
   const last=path.knots[path.knots.length-1],remaining=target-path.u;
   if(++path.attempts>MAX_STEPS){path.failure={t:last.t,reason:'work limit'};break;}
   if(!bounded([last.x,last.v])){path.failure={t:last.t,reason:'state limit'};break;}
   const size=Math.min(path.h,remaining),h=path.direction*size,y=[last.x,last.v];
   if(size<MIN_STEP&&remaining>MIN_STEP){path.failure={t:last.t,reason:'resolution limit'};break;}
   if(path.u+size===path.u){path.failure={t:last.t,reason:'resolution limit'};break;}
   const coarse=rk4(last.t,y,h),half=rk4(last.t,y,h/2),fine=rk4(last.t+h/2,half,h/2);
   const error=Math.max(...fine.map((value,i)=>Math.abs(value-coarse[i])/15/(1e-10+2e-8*Math.max(Math.abs(y[i]),Math.abs(value)))));
   if(Number.isFinite(error)&&error<=1&&bounded(fine)){
    path.u=size===remaining?target:path.u+size;
    path.knots.push(knot(path.direction*path.u,fine));
    path.h=Math.min(MAX_STEP,size*Math.min(2,Math.max(.25,.9*Math.max(error,1e-12)**(-.2))));
   }else{
    path.h=size*(Number.isFinite(error)&&error>0?Math.max(.1,Math.min(.5,.9*error**(-.2))):.1);
    if(path.h<MIN_STEP)path.failure={t:last.t,reason:bounded(fine)?'resolution limit':'state limit'};
   }
  }
 }
 function at(t){
  if(!validTime(t))throw new RangeError('Time must be between −500 and 500.');
  if(t===0)return point(0,x0,v0);
  const path=t<0?backward:forward,u=Math.abs(t);ensure(path,u);
  if(u>path.u)return clipped(t);
  const data=path.knots;let low=0,high=data.length-1;
  while(low<high){const mid=Math.ceil((low+high)/2);if(Math.abs(data[mid].t)<=u)low=mid;else high=mid-1;}
  const a=data[low];if(a.t===t||low===data.length-1)return point(t,a.x,a.v);
  const c=data[low+1],h=c.t-a.t,s=(t-a.t)/h,s2=s*s,s3=s2*s;
  // Hermite interpolation matches both the state and its derivative at knots,
  // providing a continuous moving marker without reintegration on every frame.
  const interpolate=(y0,d0,y1,d1)=>(2*s3-3*s2+1)*y0+(s3-2*s2+s)*h*d0+(-2*s3+3*s2)*y1+(s3-s2)*h*d1;
  const x=interpolate(a.x,a.v,c.x,c.v),v=interpolate(a.v,a.a,c.v,c.a);
  return bounded([x,v])?point(t,x,v):clipped(t);
 }
 function sampleInterval(start,end,count){
  if(!validTime(start)||!validTime(end)||start>=end||(count!==undefined&&(!Number.isInteger(count)||count<2||count>20000)))throw new RangeError('Invalid sampling interval.');
  if(start<0)ensure(backward,-start);if(end>0)ensure(forward,end);
  if(count!==undefined)return Array.from({length:count+1},(_,i)=>at(i===count?end:start+(end-start)*i/count));
  const middle=[...backward.knots.slice(1).reverse(),...forward.knots].filter(p=>p.t>start&&p.t<end);
  return [at(start),...middle.map(p=>point(p.t,p.x,p.v)),at(end)];
 }
 return {at,sampleInterval,sample:(end,count)=>sampleInterval(0,end,count),particular:()=>null,response:null,naturalFrequency:null,regime,
  limits:()=>[backward,forward].filter(path=>path.failure).map(path=>({...path.failure,direction:path.direction}))};
}
