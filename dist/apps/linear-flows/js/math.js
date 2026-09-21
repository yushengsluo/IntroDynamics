export const matVec=(A,x)=>A.map(row=>row.reduce((s,a,j)=>s+a*x[j],0));
export const identity=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j)));
export const multiply=(A,B)=>A.map(row=>B[0].map((_,j)=>row.reduce((s,v,k)=>s+v*B[k][j],0)));
export const determinant=A=>A.length===2?A[0][0]*A[1][1]-A[0][1]*A[1][0]:A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])-A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])+A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
export const trace=A=>A.reduce((s,r,i)=>s+r[i],0);
export function expm(A,t){
 const n=A.length,norm=Math.max(...A.map(r=>r.reduce((s,v)=>s+Math.abs(v*t),0)));if(!Number.isFinite(norm))throw new RangeError('Matrix exponential input is too large.');const s=Math.max(0,Math.ceil(Math.log2(norm)+1)||0),B=A.map(r=>r.map(v=>v*t/2**s));let E=identity(n),term=identity(n);
 for(let k=1;k<=24;k++){term=multiply(term,B).map(r=>r.map(v=>v/k));E=E.map((r,i)=>r.map((v,j)=>v+term[i][j]));if(Math.max(...term.flat().map(Math.abs))<1e-16)break;}
 for(let k=0;k<s;k++)E=multiply(E,E);return E;
}
export function trajectory(A,x,T,steps=900){const dt=T/steps,M=expm(A,dt),points=[{t:0,x:[...x]}];let current=[...x];for(let i=1;i<=steps;i++){current=matVec(M,current);if(current.some(v=>!Number.isFinite(v)||Math.abs(v)>1e5))break;points.push({t:i*dt,x:current});}return points;}
// Evaluate each sample from x(0). Growth at negative times must not erase
// a valid forward branch, and omitted samples must not join across a gap.
export function trajectoriesInInterval(A,seeds,start,end,steps=1200,evaluators=[]){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)throw new RangeError('Start time must be less than end time.');
 const times=Array.from({length:steps+1},(_,i)=>i===steps?end:start+(end-start)*i/steps);
 if(start<0&&end>0&&!times.includes(0))times.push(0);
 times.sort((a,b)=>a-b);
 const paths=seeds.map(()=>[]);
 for(const t of times){
  const M=t===0?null:expm(A,t);
  seeds.forEach((seed,i)=>{
   const x=t===0||seed.every(v=>v===0)?[...seed]:(evaluators[i]?.(t)??matVec(M,seed));
   paths[i].push({t,x:x.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e5)?x:null});
  });
 }
 return paths;
}
export function eigenvalues(A){
 const scale=Math.max(...A.flat().map(Math.abs));if(scale===0)return A.map(()=>({re:0,im:0}));const B=A.map(r=>r.map(v=>v/scale)),tr=trace(B),det=determinant(B);let roots;
 if(A.length===2){const half=tr/2,h=(B[0][0]-B[1][1])/2,d=h*h+B[0][1]*B[1][0];if(d>=0){const large=half+(half<0?-1:1)*Math.sqrt(d),small=large===0?0:det/large;roots=[{re:large,im:0},{re:small,im:0}];}else roots=[{re:half,im:Math.sqrt(-d)},{re:half,im:-Math.sqrt(-d)}];}
 else{const C=B.map((r,i)=>r.map((v,j)=>v-(i===j?tr/3:0))),a=-tr,p=-trace(multiply(C,C))/2,q=-determinant(C),D=q*q/4+p*p*p/27,tol=64*Number.EPSILON*(q*q/4+Math.abs(p*p*p/27));
 if(D>tol){const u=Math.cbrt(-q/2-(q<0?-1:1)*Math.sqrt(D)),v=u===0?0:-p/(3*u);roots=[{re:u+v-a/3,im:0},{re:-(u+v)/2-a/3,im:Math.sqrt(3)*(u-v)/2},{re:-(u+v)/2-a/3,im:-Math.sqrt(3)*(u-v)/2}];}
 else if(D < -tol){const r=2*Math.sqrt(-p/3),theta=Math.acos(Math.max(-1,Math.min(1,(3*q/(2*p))*Math.sqrt(-3/p))))/3;roots=[0,1,2].map(k=>({re:r*Math.cos(theta-2*Math.PI*k/3)-a/3,im:0}));}
 else {const u=Math.cbrt(-q/2),candidates=[2*u-a/3,-u-a/3],root=candidates.reduce((x,y)=>Math.abs(x)>Math.abs(y)?x:y);if(root===0){roots=[0,0,0].map(()=>({re:0,im:0}));}else{const sum=tr-root,product=det/root,disc=sum*sum-4*product;if(disc>=0){const large=(sum+(sum<0?-1:1)*Math.sqrt(disc))/2,small=large===0?0:product/large;roots=[{re:root,im:0},{re:large,im:0},{re:small,im:0}];}else roots=[{re:root,im:0},{re:sum/2,im:Math.sqrt(-disc)/2},{re:sum/2,im:-Math.sqrt(-disc)/2}];}}}
 return roots.map(e=>({re:e.re*scale,im:e.im*scale}));
}
export function rank(A,tol=1e-8){const M=A.map(r=>[...r]);let rank=0;for(let j=0;j<A.length;j++){let pivot=rank;for(let k=rank+1;k<A.length;k++)if(Math.abs(M[k][j])>Math.abs(M[pivot]?.[j]??0))pivot=k;if(rank>=A.length||Math.abs(M[pivot][j])<tol)continue;[M[rank],M[pivot]]=[M[pivot],M[rank]];for(let k=rank+1;k<A.length;k++){const f=M[k][j]/M[rank][j];for(let l=j;l<A.length;l++)M[k][l]-=f*M[rank][l];}rank++;}return rank;}
export function analyze(A){const eig=eigenvalues(A),tol=1e-10*(Math.max(...eig.map(e=>Math.hypot(e.re,e.im)))||1),pos=eig.some(e=>e.re>tol),neg=eig.some(e=>e.re< -tol),allNeg=eig.every(e=>e.re< -tol),allPos=eig.every(e=>e.re>tol),complex=eig.some(e=>Math.abs(e.im)>tol),zeros=eig.filter(e=>Math.abs(e.re)<tol&&Math.abs(e.im)<tol).length,defective=zeros>0&&A.length-rank(A,1e-10*(Math.max(...A.flat().map(Math.abs))||1))<zeros;
 let title,status,kind,description;
 if(allNeg){title=complex?'Stable spiral':'Stable node';status='Asymptotically stable';kind='stable';description=complex?'Solutions spiral toward the origin. Negative real parts cause decay; imaginary parts create rotation.':'All solutions approach the origin. Every eigenvalue has a negative real part.';}
 else if(pos||defective){title=pos&&neg?'Saddle':complex?'Unstable spiral':allPos?'Unstable node':defective?'Shear / degenerate':'Unstable system';status='Unstable';kind='unstable';description=pos&&neg?'Some directions contract while others grow. The origin is a saddle, with both stable and unstable directions.':defective?'Repeated zero eigenvalues have too few independent eigenvectors. Some solutions grow polynomially with time.':'At least one growing mode pushes solutions away from the origin.';}
 else{title=complex?'Center / rotation':neg?'Stable equilibrium set':'Equilibrium system';status='Stable · no asymptotic decay';kind='neutral';description=complex?(neg?'Rotation persists while the remaining direction decays. Solutions do not all approach the origin.':'Solutions rotate without decay. The origin is stable, but solutions do not converge to it.'):neg?'Decaying modes approach a set of equilibria. Zero modes remain constant.':'Every point is an equilibrium. Initial conditions remain fixed through time.';}
 return{eig,title,status,kind,description,trace:trace(A),det:determinant(A)};
}
