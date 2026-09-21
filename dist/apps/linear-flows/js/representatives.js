import {eigenvalues,identity,multiply,matVec,determinant} from './math.js';

const norm=v=>Math.hypot(...v);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const scaled=(v,s)=>v.map(x=>x*s);
const unit=v=>scaled(v,1/norm(v));
const number=v=>v===0?'0':Number(v.toPrecision(4)).toString();

function nullspace(matrix,tolerance=2e-7){
 const rows=matrix.map(r=>[...r]),n=rows.length,pivots=[];
 const magnitude=Math.max(...rows.flat().map(Math.abs));
 if(magnitude===0)return identity(n);
 for(const row of rows)for(let j=0;j<n;j++)row[j]/=magnitude;
 let k=0;
 for(let column=0;column<n&&k<n;column++){
  let best=k;for(let i=k+1;i<n;i++)if(Math.abs(rows[i][column])>Math.abs(rows[best][column]))best=i;
  if(Math.abs(rows[best][column])<tolerance)continue;
  [rows[k],rows[best]]=[rows[best],rows[k]];
  const pivot=rows[k][column];for(let j=0;j<n;j++)rows[k][j]/=pivot;
  for(let i=0;i<n;i++)if(i!==k){const f=rows[i][column];for(let j=0;j<n;j++)rows[i][j]-=f*rows[k][j];}
  pivots.push(column);k++;
 }
 return Array.from({length:n},(_,j)=>j).filter(j=>!pivots.includes(j)).map(free=>{
  const v=Array(n).fill(0);v[free]=1;pivots.forEach((column,i)=>v[column]=-rows[i][free]);return unit(v);
 });
}

function independent(candidate,basis){
 let v=[...candidate];
 for(const b of basis){const f=dot(v,b);v=v.map((x,i)=>x-f*b[i]);}
 return norm(v)>1e-6?unit(v):null;
}

function spectralGroups(A){
 const n=A.length,scale=Math.max(...A.flat().map(Math.abs))||1;
 const roots=eigenvalues(A),groups=[];
 const complexTolerance=n===2?0:scale*1e-10;
 const complex=roots.find(e=>e.im>complexTolerance);
 if(complex){
  const a=complex.re,b=complex.im,N=A.map((r,i)=>r.map((v,j)=>(v-(i===j?a:0))/scale));
  const Q=multiply(N,N).map((r,i)=>r.map((v,j)=>v+(i===j?(b/scale)**2:0)));
  const basis=n===2?identity(2):nullspace(Q);
  if(basis.length){
   const v=basis[0],rotated=scaled(matVec(N,v),scale/b);
   groups.push({type:'complex',a,b,choices:[{vector:v,terms:[v,rotated],order:1}],label:Math.abs(a)<scale*1e-9?'Periodic orbit':a<0?'Spiral inward':'Spiral outward'});
  }
 }
 const realRoots=roots.filter(e=>Math.abs(e.im)<=complexTolerance).map(e=>determinant(A)===0&&Math.abs(e.re)<scale*1e-12?0:e.re).sort((a,b)=>a-b);
 const realGroups=[];
 for(const value of realRoots){
  let group=realGroups.find(g=>Math.abs(g.value-value)<=1e-6*Math.max(Math.abs(g.value),Math.abs(value),scale*1e-8));
  if(group)group.count++;else realGroups.push({value,count:1});
 }
 for(const {value:a,count} of realGroups){
  const N=A.map((r,i)=>r.map((v,j)=>v-(i===j?a:0)));
  const divisor=Math.max(...N.flat().map(Math.abs))||1,B=N.map(r=>r.map(v=>v/divisor));
  let power=identity(n);const basis=[],choices=[];
  for(let order=1;order<=count;order++){
   power=multiply(power,B);
   // Absolute small powers represent a numerical zero for a Jordan block.
   const kernel=Math.max(...power.flat().map(Math.abs))<1e-12?identity(n):nullspace(power);
   for(const candidate of kernel){
    const v=independent(candidate,basis);if(!v)continue;
    basis.push(v);
    const terms=[v];for(let k=1;k<order;k++)terms.push(matVec(N,terms.at(-1)));
    choices.push({vector:v,terms,order});if(choices.length>=count)break;
   }
   if(choices.length>=count)break;
  }
  if(choices.length)groups.push({type:'real',a,choices,label:a===0?'Equilibrium direction':a<0?'Stable direction':'Unstable direction'});
 }
 return groups;
}

export function representativeSeeds(A,radius=3){
 const n=A.length,groups=spectralGroups(A),results=[{x:Array(n).fill(0),label:'Equilibrium · origin',source:'auto',components:[]}];
 const visit=(index,components,labels,signs)=>{
  if(index===groups.length){
   if(!components.length)return;
   const sum=Array(n).fill(0);for(const c of components)c.terms[0].forEach((v,j)=>sum[j]+=v);
   const length=norm(sum);if(length<1e-8)return;
   const factor=radius/length,x=scaled(sum,factor);
   const types=[...new Set(components.map(c=>c.type==='complex'?'rotation':c.a===0?(c.terms.length>1?'drift':'equilibrium'):c.a<0?'stable':'unstable'))];
   const behavior=types.length===1?types[0]+' mixed modes':types.join(' + ');
   const label=components.length===1?labels[0]:behavior[0].toUpperCase()+behavior.slice(1)+` (${signs.join(', ')})`;
   results.push({x,label,source:'auto',components:components.map(c=>({...c,terms:c.terms.map(v=>scaled(v,factor))}))});return;
  }
  visit(index+1,components,labels,signs);
  const group=groups[index];
  for(const choice of group.choices){
   for(const sign of group.type==='complex'?[1]:[1,-1]){
    const terms=choice.terms.map(v=>scaled(v,sign));
    const label=choice.order>1?(group.a===0?`${choice.order===2?'Linear':'Quadratic'} drift`:`Jordan mode · order ${choice.order}`):group.label;
    const detail=group.type==='real'?` · λ = ${number(group.a)} · ${sign>0?'+':'−'}`:'';
    visit(index+1,[...components,{type:group.type,a:group.a,b:group.b,terms}],[...labels,label+detail],[...signs,group.type==='complex'?'rotation':sign>0?'+':'−']);
   }
  }
 };
 visit(0,[],[],[]);
 // Nearly coincident numerical roots can make a basis uncertain. Keep finite
 // sample directions available without claiming they are invariant modes.
 if(results.length===1&&A.some(r=>r.some(v=>v!==0)))for(const v of identity(n))results.push({x:scaled(v,radius),label:'Sample direction',source:'auto',components:null});
 return results;
}

// Keep a pair of samples on the lower real eigenvalue branch. Continuing the
// same coordinates into complex spectra avoids adding/removing paths at a boundary.
export function trackedDirectionSeed(A,radius=1.5,sign=1,previous=null){
 const [[a,b],[c,d]]=A,h=(a+d)/2,k=(a-d)/2,q=k*k+b*c,s=Math.sqrt(Math.max(0,q));
 const first=[-b,k+s],second=[s-k,-c];
 // The trace–determinant family has b <= -1. Its first candidate never vanishes,
 // so it also avoids switching nonparallel continuation vectors in spiral regions.
 let v=b<0?first:(norm(first)>=norm(second)?first:second);
 if(norm(v)===0)v=previous??[1,0];
 v=unit(v);
 if(previous?dot(v,previous)<0:sign<0)v=scaled(v,-1);
 const x=v.map(value=>value===0?0:value*radius);
 // The determinant quotient retains a weak negative eigenvalue near det = 0.
 const lambda=h>=0&&h+s>0?(a*d-b*c)/(h+s):h-s;
 const behavior=q<0?'sample':lambda<0?'stable direction → origin':lambda>0?'unstable direction':'equilibrium direction';
 return {x,source:'tracked',radius,sign,label:`Tracked ${behavior}${q<0?'':` · λ = ${number(lambda)}`} · ${sign>0?'+':'−'}`,
  components:q<0?null:[{type:'real',a:lambda,terms:[x]}]};
}

// Evolve generated modes within their invariant subspaces. Multiplying a
// saddle eigenvector by the full exponential can leak into a growing mode.
export function evaluateRepresentative(seed,t){
 if(!seed.components)return null;
 const result=Array(seed.x.length).fill(0);
 for(const c of seed.components){
  const growth=Math.exp(c.a*t);
  let value;
  if(c.type==='complex')value=c.terms[0].map((v,j)=>Math.cos(c.b*t)*v+Math.sin(c.b*t)*c.terms[1][j]);
  else{value=Array(result.length).fill(0);let weight=1;for(let k=0;k<c.terms.length;k++){if(k)weight*=t/k;c.terms[k].forEach((v,j)=>value[j]+=weight*v);}}
  value.forEach((v,j)=>{result[j]+=v===0?0:v*growth;});
 }
 return result;
}
