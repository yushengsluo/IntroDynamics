const identity=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j)));
const multiply=(A,B)=>A.map(row=>B[0].map((_,j)=>row.reduce((sum,v,k)=>sum+v*B[k][j],0)));
const matVec=(A,x)=>A.map(row=>row.reduce((sum,v,j)=>sum+v*x[j],0));
export const STATE_LIMIT=1e100;

function exponential(A,t){
 const norm=Math.max(...A.map(row=>row.reduce((sum,v)=>sum+Math.abs(v*t),0)));
 const squares=Math.max(0,Math.ceil(Math.log2(norm)+1)||0);
 const B=A.map(row=>row.map(v=>v*t/2**squares));
 let result=identity(A.length),term=identity(A.length);
 for(let order=1;order<=24;order++){
  term=multiply(term,B).map(row=>row.map(v=>v/order));
  result=result.map((row,i)=>row.map((v,j)=>v+term[i][j]));
  if(Math.max(...term.flat().map(Math.abs))<1e-16)break;
 }
 for(let i=0;i<squares;i++)result=multiply(result,result);
 return result;
}

export function frequencyResponse(b,k,omega){
 const real=k-omega*omega,imaginary=b*omega,denominator=Math.hypot(real,imaginary);
 const resonant=b===0&&Math.abs(real)<=8*Number.EPSILON*Math.max(k,omega*omega);
 return {amplitude:resonant?Infinity:1/denominator,phase:resonant?null:Math.atan2(imaginary,real),resonant};
}

export function dampingRegime(b,k){
 if(b===0)return 'Undamped';
 const difference=b*b-4*k,tolerance=1e-10*Math.max(b*b,4*k);
 return Math.abs(difference)<=tolerance?'Critically damped':difference<0?'Underdamped':'Overdamped';
}

export function createSolution({b,k,omega,x0=0,v0=0}){
 if(![b,k,omega,x0,v0].every(Number.isFinite)||b<0||k<=0||omega<0)throw new RangeError('Use b ≥ 0, k > 0, ω ≥ 0, and finite initial values.');
 const response=frequencyResponse(b,k,omega);
 // Separate the periodic response when well conditioned. This avoids subtracting
 // enormous backward-growing terms for an exactly periodic initial condition.
 // Near resonance, augment by cos/sin instead, avoiding a singular particular solution.
 const separated=response.amplitude<=1e4,real=k-omega*omega,imaginary=b*omega;
 let C=0,S=0;
 if(separated){
  if(Math.abs(real)>=Math.abs(imaginary)){const ratio=imaginary/real,denominator=real+imaginary*ratio;C=1/denominator;S=ratio/denominator;}
  else{const ratio=real/imaginary,denominator=imaginary+real*ratio;C=ratio/denominator;S=1/denominator;}
 }
 const A=separated?[[0,1],[-k,-b]]:[[0,1,0,0],[-k,-b,1,0],[0,0,0,-omega],[0,0,omega,0]];
 const initial=separated?[x0-C,v0-omega*S]:[x0,v0,1,0];
 const periodic=t=>[C*Math.cos(omega*t)+S*Math.sin(omega*t),omega*(S*Math.cos(omega*t)-C*Math.sin(omega*t))];
 const zeroTransient=separated&&initial.every(value=>value===0);
 const validTime=t=>Number.isFinite(t)&&t>=-500&&t<=500;
 const point=(t,y)=>{
  const particular=separated?periodic(t):[0,0];
  const x=t===0?x0:y[0]+particular[0],v=t===0?v0:y[1]+particular[1];
  const clipped=![x,v].every(value=>Number.isFinite(value)&&Math.abs(value)<=STATE_LIMIT);
  return {t,x:clipped?null:x,v:clipped?null:v,force:Math.cos(omega*t),...(clipped?{clipped:true}:{})};
 };
 const stateAt=t=>{
  if(!validTime(t))throw new RangeError('Time must be between −500 and 500.');
  return t===0||zeroTransient?[...initial]:matVec(exponential(A,t),initial);
 };
 function march(from,to,count){
  const dt=(to-from)/count,step=exponential(A,dt);let y=stateAt(from);
  const points=[point(from,y)];
  for(let i=1;i<=count;i++){
   const t=i===count?to:from+i*dt;
   y=zeroTransient?[...initial]:i%100===0||!y.every(Number.isFinite)?stateAt(t):matVec(step,y);
   if(!separated){y[2]=Math.cos(omega*t);y[3]=Math.sin(omega*t);}
   points.push(point(t,y));
  }
  return points;
 }
 function sampleInterval(start,end,count=Math.min(20000,Math.max(1600,Math.ceil((end-start)*Math.max(omega,Math.sqrt(k))*8)))){
  if(!validTime(start)||!validTime(end)||start>=end||!Number.isInteger(count)||count<2||count>20000)throw new RangeError('Invalid sampling interval.');
  // March away from zero independently, so backward growth cannot contaminate
  // the initial condition or the forward trajectory when an interval crosses zero.
  if(end<=0)return march(end,start,count).reverse();
  if(start>=0)return march(start,end,count);
  const negativeCount=Math.max(1,Math.min(count-1,Math.round(count*(-start)/(end-start))));
  return [...march(0,start,negativeCount).reverse(),...march(0,end,count-negativeCount).slice(1)];
 }
 return {
  at:t=>point(t,stateAt(t)),
  particular(t){return response.resonant?null:separated?periodic(t)[0]:response.amplitude*Math.cos(omega*t-response.phase);},
  sample:(end,count)=>sampleInterval(0,end,count),
  sampleInterval,
  response,
  naturalFrequency:Math.sqrt(k),
  regime:dampingRegime(b,k)
 };
}
