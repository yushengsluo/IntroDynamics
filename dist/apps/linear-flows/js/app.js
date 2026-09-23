import {matVec,trajectoriesInInterval,analyze,expm} from './math.js';
import {DEFAULT_RANGE,parseCoordinate} from './coordinates.js';
import {representativeSeeds,evaluateRepresentative,trackedDirectionSeed} from './representatives.js';
import {pointOnSlice} from './placement.js';
import {MAX_3D_RANGE,scene3D,grid3DLines} from './scene.js';
import {createTraceDetPlane} from './trace-determinant.js';
import {plotPalette} from './palette.js';
const MAX_MANUAL_SEEDS=40;
const $=id=>document.getElementById(id);
let colors=plotPalette().colors;
const presets={2:{spiral:[[-.35,-1.4],[1.4,-.35]],saddle:[[1,.5],[0,-1]],center:[[0,-1],[1,0]],node:[[-.6,.3],[0,-1.2]],unstable_node:[[.6,.3],[0,1.2]],source:[[.2,-1],[1,.2]],degenerate:[[0,1],[0,0]]},3:{spiral:[[-.25,-1.4,0],[1.4,-.25,0],[0,0,-.55]],saddle:[[.5,0,0],[0,-.6,0],[0,0,-1]],center:[[0,-1,0],[1,0,0],[0,0,0]],node:[[-.4,.2,0],[0,-.8,.2],[0,0,-1.2]],unstable_node:[[.4,.2,0],[0,.8,.2],[0,0,1.2]],source:[[.15,-1,0],[1,.15,0],[0,0,.1]],degenerate:[[0,1,0],[0,0,1],[0,0,0]]}};
let state={dim:2,A:presets[2].spiral.map(r=>[...r]),seeds:[],seedMeta:[],sliceAxis:2,sliceValue:0,hover:null,timeStart:-20,timeEnd:20,t:-20,playing:false,speed:1,range:DEFAULT_RANGE,field:true,grid:true,paths:true,yaw:.65,pitch:.5,selected:0};
let paths=[],phaseCtx=$('phase-canvas').getContext('2d'),chartCtx=$('time-canvas').getContext('2d'),frame=0,previous=0;
const fmt=(v,d=2)=>v===0?'0':Math.abs(v)<.001||Math.abs(v)>=10000?v.toExponential(1):Number(v.toFixed(d)).toString();
function refreshRepresentativeSeeds(preserveManual=true){
 const manual=preserveManual?state.seeds.map((x,i)=>({...state.seedMeta[i],x})).filter(seed=>seed.source==='manual'):[];
 const radius=Math.min(3,state.range*.6),examples=representativeSeeds(state.A,radius);
 // Include all quadrants before parameter exploration, even for a spiral or center.
 if(state.dim===2)for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,x=[Math.cos(angle),Math.sin(angle)].map(v=>Math.abs(v)<1e-12?0:v*radius);
  if(!examples.some(seed=>Math.hypot(...seed.x.map((v,j)=>v-x[j]))<radius*1e-8))examples.push({x,source:'sample',label:'Fixed sample · x(0)',components:null});
 }
 if(state.dim===2)for(const sign of [1,-1])examples.push(trackedDirectionSeed(state.A,radius/2,sign));
 state.seedMeta=[...examples,...manual];state.seeds=state.seedMeta.map(seed=>[...seed.x]);state.selected=state.seeds.length>1?1:0;
}
function keepInitialPoints(){
 let changed=false;
 state.seedMeta=state.seedMeta.map(seed=>{
  if(seed.source!=='auto')return seed;
  // Cached invariant modes belong to the old matrix, but these coordinates stay fixed.
  changed=true;return {...seed,source:'sample',components:null,label:seed.x.every(v=>v===0)?'Equilibrium · origin':'Fixed sample · x(0)'};
 });
 return changed;
}
function updateTrackedPoints(A){
 state.seedMeta.forEach((seed,i)=>{
  if(seed.source!=='tracked')return;
  const next=trackedDirectionSeed(A,seed.radius,seed.sign,state.seeds[i]);
  state.seedMeta[i]=next;state.seeds[i]=[...next.x];
 });
}
function seedAt(i,t,transition){return evaluateRepresentative(state.seedMeta[i],t)??matVec(transition,state.seeds[i]);}
function renderControls({renderMatrix=true,renderSeeds=true}={}){
 $('initial-error').textContent='';
 $('trace-panel').hidden=state.dim!==2;$('portrait-layout').classList.toggle('has-trace-plane',state.dim===2);if(state.dim!==2)tracePlane.cancel();
 if(renderMatrix){$('matrix').style.gridTemplateColumns=`repeat(${state.dim},1fr)`;$('matrix').innerHTML=state.A.map((row,i)=>row.map((v,j)=>`<input type="number" value="${v}" min="-20" max="20" step="any" aria-label="Matrix row ${i+1}, column ${j+1}" data-row="${i}" data-col="${j}">`).join('')).join('');}
 if(renderSeeds){$('initials').innerHTML=state.seeds.map((seed,i)=>`<div class="seed-entry"><div class="seed-row ${state.dim===3?'three':''}"><span id="seed-dot-${i}" class="seed-dot" style="background:${colors[i%colors.length]}"></span>${seed.map((v,j)=>`<label class="seed-coordinate"><span>x${'₁₂₃'[j]}</span><input id="seed-${i}-${j}" type="text" inputmode="text" autocomplete="off" spellcheck="false" value="${v}" aria-describedby="initial-error" aria-label="Trajectory ${i+1}, coordinate ${j+1}" data-seed="${i}" data-axis="${j}"></label>`).join('')}<button class="remove-seed" aria-label="Remove trajectory ${i+1}" data-remove="${i}" ${state.seeds.length===1?'disabled':''}>×</button></div><div id="seed-label-${i}" class="seed-behavior">${state.seedMeta[i]?.label||'Custom point'}</div></div>`).join('');
 $('chart-trajectory').innerHTML=state.seeds.map((_,i)=>`<option value="${i}">${i+1}</option>`).join('');$('chart-trajectory').value=state.selected;$('add-trajectory').disabled=state.seedMeta.filter(s=>s.source==='manual').length>=MAX_MANUAL_SEEDS;
 }else state.seedMeta.forEach((seed,i)=>{if(seed.source!=='tracked')return;seed.x.forEach((v,j)=>$('seed-'+i+'-'+j).value=v);$('seed-label-'+i).textContent=seed.label;});
 $('dim-2').classList.toggle('selected',state.dim===2);$('dim-3').classList.toggle('selected',state.dim===3);$('dim-2').setAttribute('aria-pressed',state.dim===2);$('dim-3').setAttribute('aria-pressed',state.dim===3);
 $('dimension-label').textContent=`${state.dim} dimensions`;$('axis-caption').textContent=state.dim===2?'x₁ · x₂':'x₁ · x₂ · x₃';$('plot-hint').innerHTML=state.dim===2?'<span class="hint-cross">+</span> Click to add a trajectory':'<span class="hint-cross">+</span> Click to place · drag to orbit';$('seed-hint').textContent=state.dim===2?'Enter positive or negative coordinates, or click the portrait.':'Click the selected plane to add x(0). Drag to orbit.';document.querySelector('.legend-z').hidden=state.dim===2;
 $('placement-bar').hidden=state.dim===2;$('slice-plane').value=String(state.sliceAxis);$('slice-value').value=state.sliceValue;$('slice-axis-label').textContent='x'+'₁₂₃'[state.sliceAxis]+' =';
 $('phase-canvas').setAttribute('aria-label',state.dim===2?'Phase portrait. Click to add an initial point at t = 0.':'Phase portrait. Click to add a point on the selected coordinate plane; drag or use arrow keys to rotate.');
}
function rebuild(steps=1200){
 paths=trajectoriesInInterval(state.A,state.seeds,state.timeStart,state.timeEnd,steps,state.seedMeta.map(meta=>meta.components?t=>evaluateRepresentative(meta,t):null));const a=analyze(state.A);
 if(state.dim===2){tracePlane.setSystem(state.A);$('trace-mode').textContent=a.title;}
 $('system-title').textContent=a.title;$('stability-badge').className=`badge ${a.kind}`;$('stability-badge').innerHTML=`<span></span>${a.status}`;$('insight').textContent=a.description;$('trace').textContent=fmt(a.trace);$('determinant').textContent=fmt(a.det);
 const eps=1e-10*Math.max(1,...state.A.flat().map(Math.abs));$('eigenvalues').innerHTML=a.eig.map((e,i)=>`<div class="eigen-chip"><span>λ${'₁₂₃'[i]}</span>${fmt(Math.abs(e.re)<eps?0:e.re)}${Math.abs(e.im)>eps?` ${e.im<0?'−':'+'} ${fmt(Math.abs(e.im))}i`:''}</div>`).join('');
 $('equations').innerHTML=state.A.map((r,i)=>`<div>x${'₁₂₃'[i]}′ = ${r.map((v,j)=>`${j?(v<0?' − ':' + '):(v<0?'−':'')}${fmt(Math.abs(v))}x${'₁₂₃'[j]}`).join('')}</div>`).join('');$('trajectory-count').textContent=`${state.seeds.length} trajector${state.seeds.length===1?'y':'ies'}${paths.some(p=>p.some(point=>point.x===null))?' · values beyond ±10⁵ omitted':''}`;draw();
}
function canvasSize(canvas,ctx){const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(r.width*dpr)||canvas.height!==Math.round(r.height*dpr)){canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);return{w:r.width,h:r.height};}
function projection(w,h){const scale=Math.min(w,h)/(state.range*2);return x=>{if(state.dim===2)return[w/2+x[0]*scale,h/2-x[1]*scale,0];const a=x[0]*Math.cos(state.yaw)-x[1]*Math.sin(state.yaw),b=x[0]*Math.sin(state.yaw)+x[1]*Math.cos(state.yaw),v=b*Math.sin(state.pitch)+x[2]*Math.cos(state.pitch),depth=b*Math.cos(state.pitch)-x[2]*Math.sin(state.pitch);return[w/2+a*scale,h/2-v*scale,depth];};}
function draw(){drawPhase();drawChart();$('time-label').textContent=`t = ${state.t.toFixed(2)}`;$('timeline').value=state.t;}
function arrow(c,p,q,color,size=4){const dx=q[0]-p[0],dy=q[1]-p[1],a=Math.atan2(dy,dx);if(Math.hypot(dx,dy)<1)return;c.strokeStyle=color;c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(q[0],q[1]);c.moveTo(q[0]-size*Math.cos(a-.48),q[1]-size*Math.sin(a-.48));c.lineTo(q[0],q[1]);c.lineTo(q[0]-size*Math.cos(a+.48),q[1]-size*Math.sin(a+.48));c.stroke();}
function drawPhase(){const palette=plotPalette(),c=phaseCtx,{w,h}=canvasSize($('phase-canvas'),c);if(w<=0||h<=0)return;const scale=Math.min(w,h)/(state.range*2),project=projection(w,h),scene=state.dim===3?scene3D(state.range,w,h,state.yaw,state.pitch):null;c.clearRect(0,0,w,h);c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
 if(state.grid&&state.dim===2){const step=state.range>12?5:state.range>6?2:state.range<2?.25:1;c.lineWidth=1;for(let v=-Math.ceil(w/scale/2/step)*step;v<=w/scale/2;v+=step){const [x]=project([v,0]);c.strokeStyle=Math.abs(v)<1e-9?palette.axis:palette.grid;c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();if(Math.abs(v)>1e-9){c.fillStyle=palette.tick;c.font='10px monospace';c.fillText(fmt(v),x+4,h/2+15);}}for(let v=-Math.ceil(h/scale/2/step)*step;v<=h/scale/2;v+=step){const [,y]=project([0,v]);c.strokeStyle=Math.abs(v)<1e-9?palette.axis:palette.grid;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();if(Math.abs(v)>1e-9){c.fillStyle=palette.tick;c.font='10px monospace';c.fillText(fmt(v),w/2+7,y-5);}}c.fillStyle=palette.label;c.font='12px monospace';c.fillText('x₁',w-26,h/2-10);c.fillText('x₂',w/2+10,20);}
 if(state.grid&&state.dim===3){
  // Batch each opacity level so overlapping depth lines do not accumulate darkness.
  c.lineWidth=1;
  for(const major of [false,true]){
   c.strokeStyle=major?palette.grid3DMajor:palette.grid3D;c.beginPath();
   for(const line of grid3DLines(scene)){if(line.major!==major)continue;c.moveTo(...project(line.a).slice(0,2));c.lineTo(...project(line.b).slice(0,2));}
   c.stroke();
  }
  for(let axis=0;axis<3;axis++){
   const a=[0,0,0],b=[0,0,0];a[axis]=-scene.gridExtents[axis];b[axis]=scene.gridExtents[axis];
   const start=project(a),end=project(b);c.strokeStyle=palette.axes3D[axis];c.beginPath();c.moveTo(start[0],start[1]);c.lineTo(end[0],end[1]);c.stroke();
   const dx=end[0]-w/2,dy=end[1]-h/2,t=Math.min(1,(w/2-24)/(Math.abs(dx)||1),(h/2-24)/(Math.abs(dy)||1));
   c.fillStyle=colors[axis];c.font='12px monospace';c.fillText('x'+'₁₂₃'[axis],w/2+dx*t+5,h/2+dy*t-5);
  }
  c.fillStyle=palette.tick;c.font='10px monospace';c.fillText(`Grid spacing: ${fmt(scene.gridStep)}`,16,22);
 }
 if(state.dim===3){
  const r=scene.radius,axes=[0,1,2].filter(i=>i!==state.sliceAxis),corner=(a,b)=>{const p=[0,0,0];p[state.sliceAxis]=state.sliceValue;p[axes[0]]=a;p[axes[1]]=b;return project(p);};
  c.fillStyle=palette.sliceFill;c.strokeStyle=palette.sliceStroke;c.lineWidth=1;c.setLineDash([5,5]);c.beginPath();
  [[-r,-r],[r,-r],[r,r],[-r,r]].forEach(([a,b],i)=>{const p=corner(a,b);i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]);});c.closePath();c.fill();c.stroke();c.setLineDash([]);
 }
 if(state.field){c.lineWidth=1;if(state.dim===2){
  const spacing=DEFAULT_RANGE/7,length=DEFAULT_RANGE*.065,columns=Math.ceil(w/(2*scale*spacing)),rows=Math.ceil(h/(2*scale*spacing));
  // Sample a fixed world lattice, extending it to cover the visible viewport.
  for(let i=-columns;i<=columns;i++)for(let j=-rows;j<=rows;j++){
   const x=i*spacing,y=j*spacing,v=matVec(state.A,[x,y]),len=Math.hypot(...v);if(len<1e-12)continue;
   const vx=v[0]/len*length,vy=v[1]/len*length;
   arrow(c,project([x-vx/2,y-vy/2]),project([x+vx/2,y+vy/2]),palette.field2D,length*scale*.27);
  }
 }else{
  const [nx,ny,nz]=scene.counts,s=scene.fieldStep;
  for(let x=-nx;x<=nx;x++)for(let y=-ny;y<=ny;y++)for(let z=-nz;z<=nz;z++){
   const p=[x*s,y*s,z*s],start=project(p),margin=scene.fieldLength*scale;
   if(start[0]<-margin||start[0]>w+margin||start[1]<-margin||start[1]>h+margin)continue;
   const magnitude=Math.max(...p.map(Math.abs));if(magnitude===0)continue;
   const v=matVec(state.A,p.map(value=>value/magnitude)),norm=Math.hypot(...v);if(norm<1e-12)continue;
   const q=p.map((a,i)=>a+v[i]/norm*scene.fieldLength);
   arrow(c,start,project(q),palette.field3D,scene.fieldLength*scale/6);
  }
 }}
 const transition=expm(state.A,state.t);
 paths.forEach((points,i)=>{const color=colors[i%colors.length];c.strokeStyle=color;c.lineWidth=1.8;c.globalAlpha=.83;c.beginPath();let connected=false;for(const p of points){if(!state.paths&&p.t>state.t)break;if(!p.x){connected=false;continue;}const q=project(p.x);if(connected)c.lineTo(q[0],q[1]);else c.moveTo(q[0],q[1]);connected=true;}c.stroke();c.globalAlpha=1;
  const start=project(state.seeds[i]);c.fillStyle=palette.surface;c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();c.arc(start[0],start[1],i===state.selected?5.5:4,0,Math.PI*2);c.fill();c.stroke();
  for(const fraction of [.065,.2,.43]){const j=Math.floor(points.length*fraction);if(j<2||!points[j].x||!points[j-2].x||(!state.paths&&points[j].t>state.t))continue;const p=project(points[j-2].x),q=project(points[j].x);if(Math.hypot(q[0]-start[0],q[1]-start[1])>15&&Math.hypot(q[0]-w/2,q[1]-h/2)>14){c.lineWidth=1.4;arrow(c,p,q,color,5);}}
  const current=seedAt(i,state.t,transition);if(current.every(Number.isFinite)){const q=project(current);if(q[0]>-10&&q[0]<w+10&&q[1]>-10&&q[1]<h+10){c.shadowColor=color;c.shadowBlur=13;c.fillStyle=color;c.beginPath();c.arc(q[0],q[1],4.4,0,Math.PI*2);c.fill();c.shadowBlur=0;c.strokeStyle=palette.markerOutline;c.lineWidth=1;c.stroke();}}
 });if(state.hover){const p=project(state.hover);c.strokeStyle=palette.hover;c.lineWidth=1.5;c.setLineDash([3,3]);c.beginPath();c.arc(p[0],p[1],7,0,Math.PI*2);c.stroke();c.setLineDash([]);c.fillStyle=palette.hoverText;c.font='12px monospace';c.fillText('('+state.hover.map(v=>fmt(v)).join(', ')+')',Math.min(w-160,p[0]+12),Math.max(18,p[1]-12));}
 c.fillStyle=palette.origin;c.beginPath();c.arc(w/2,h/2,2.5,0,Math.PI*2);c.fill();c.restore();
}
function drawChart(){
 const palette=plotPalette(),c=chartCtx,{w,h}=canvasSize($('time-canvas'),c);if(w<=0||h<=0)return;c.clearRect(0,0,w,h);
 const points=paths[state.selected]||[],max=Math.max(.5,...points.flatMap(p=>p.x?p.x.map(Math.abs):[])),left=50,top=8,cw=w-left-12,ch=h-top-23;
 const timeX=t=>left+(t-state.timeStart)/(state.timeEnd-state.timeStart)*cw;
 c.font='9px monospace';
 for(let i=0;i<3;i++){const y=top+i*ch/2;c.strokeStyle=palette.grid;c.beginPath();c.moveTo(left,y);c.lineTo(w,y);c.stroke();c.fillStyle=palette.tick;c.fillText(fmt(max-i*max,1),1,y+3);}
 for(let i=0;i<=4;i++){const t=state.timeStart+(state.timeEnd-state.timeStart)*i/4;c.fillStyle=palette.tick;c.textAlign=i===0?'left':i===4?'right':'center';c.fillText(fmt(t),timeX(t),h-4);}c.textAlign='left';
 c.save();c.beginPath();c.rect(left,top-1,cw,ch+2);c.clip();
 if(state.timeStart<0&&state.timeEnd>0){c.strokeStyle=palette.axis;c.beginPath();c.moveTo(timeX(0),top);c.lineTo(timeX(0),top+ch);c.stroke();}
 for(let k=0;k<state.dim;k++){
  c.strokeStyle=colors[k];c.lineWidth=1.5;c.beginPath();let connected=false;
  for(const p of points){if(!p.x){connected=false;continue;}const x=timeX(p.t),y=top+ch/2-p.x[k]/max*ch/2;connected?c.lineTo(x,y):c.moveTo(x,y);connected=true;}c.stroke();
 }
 c.strokeStyle=palette.cursor;c.setLineDash([3,3]);c.beginPath();c.moveTo(timeX(state.t),top);c.lineTo(timeX(state.t),top+ch);c.stroke();c.setLineDash([]);c.restore();
}
function pause(){state.playing=false;cancelAnimationFrame(frame);$('play').textContent='▶';$('play').setAttribute('aria-label','Play animation');}
function tick(now){if(!state.playing)return;state.t=Math.min(state.timeEnd,state.t+Math.min((now-previous)/1000,.1)*state.speed);previous=now;draw();if(state.t>=state.timeEnd)pause();else frame=requestAnimationFrame(tick);}
function play(){if(state.playing){pause();return;}if(state.t>=state.timeEnd)state.t=state.timeStart;state.playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause animation');previous=performance.now();frame=requestAnimationFrame(tick);}
function resetTime(){pause();state.t=state.timeStart;}
function applyPreset(name,dim=state.dim){resetTime();state.dim=dim;state.A=presets[dim][name].map(r=>[...r]);state.range=DEFAULT_RANGE;state.hover=null;$('placement-status').textContent='';refreshRepresentativeSeeds(false);$('preset').value=name;$('matrix-error').textContent='';renderControls();rebuild();}
function switchDimension(dim){if(state.dim===dim)return;const name=$('preset').value;if(name!=='custom'){applyPreset(name,dim);return;}resetTime();state.A=Array.from({length:dim},(_,i)=>Array.from({length:dim},(_,j)=>state.A[i]?.[j]??(i===j?-.5:0)));state.dim=dim;state.range=DEFAULT_RANGE;state.hover=null;refreshRepresentativeSeeds(false);renderControls();rebuild();}
function addSeed(seed){
 if(state.seedMeta.filter(s=>s.source==='manual').length>=MAX_MANUAL_SEEDS){$('placement-status').textContent=`Up to ${MAX_MANUAL_SEEDS} manually added points are supported. Remove a custom point to add another.`;return;}
 if(!seed.every(v=>Number.isFinite(v)&&Math.abs(v)<=100)){$('placement-status').textContent='Choose coordinates between −100 and 100.';return;}
 pause();state.t=Math.max(state.timeStart,Math.min(state.timeEnd,0));
 const x=[...seed];state.seeds.push(x);state.seedMeta.push({x,source:'manual',label:'Placed point · x(0)',components:null});state.selected=state.seeds.length-1;
 $('placement-status').textContent='Added x(0) = ('+x.map(v=>fmt(v)).join(', ')+').';renderControls();rebuild();
}
function zoom(factor){if(!(factor>0))return;state.hover=null;state.range=Math.max(.5,Math.min(state.dim===3?MAX_3D_RANGE:40,state.range*factor));drawPhase();}
$('guide-button').onclick=()=>$('guide').showModal();$('guide').addEventListener('click',e=>{if(e.target===$('guide')){const b=$('guide').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)$('guide').close();}});
$('dim-2').onclick=()=>switchDimension(2);$('dim-3').onclick=()=>switchDimension(3);$('preset').onchange=e=>{if(e.target.value!=='custom')applyPreset(e.target.value);};
$('matrix').addEventListener('change',e=>{const input=e.target,v=Number(input.value);if(input.value.trim()===''||!Number.isFinite(v)||Math.abs(v)>20){$('matrix-error').textContent='Matrix entries must be between −20 and 20.';input.value=state.A[input.dataset.row][input.dataset.col];return;}$('matrix-error').textContent='';resetTime();state.A[input.dataset.row][input.dataset.col]=v;$('preset').value='custom';refreshRepresentativeSeeds();renderControls({renderMatrix:false});rebuild();});
$('matrix').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input[data-row]')){e.preventDefault();e.target.blur();}});
function updateInitial(input,commit=false){
 if(!input.matches('input[data-seed]'))return;
 const value=parseCoordinate(input.value);
 if(value===null){
  if(commit){input.setAttribute('aria-invalid','true');$('initial-error').textContent='Enter a number from −100 to 100, such as −20 or −2.5.';}
  return;
 }
 input.removeAttribute('aria-invalid');$('initial-error').textContent='';
 if(commit)input.value=String(value);
 if(state.seeds[input.dataset.seed][input.dataset.axis]===value)return;
 resetTime();state.seeds[input.dataset.seed][input.dataset.axis]=value;state.seedMeta[input.dataset.seed]={x:[...state.seeds[input.dataset.seed]],source:'manual',label:'Custom point · x(0)',components:null};
 input.closest('.seed-entry').querySelector('.seed-behavior').textContent='Custom point · x(0)';rebuild();
}
$('initials').addEventListener('input',e=>updateInitial(e.target));
$('initials').addEventListener('change',e=>updateInitial(e.target,true));
$('initials').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input[data-seed]')){e.preventDefault();updateInitial(e.target,true);e.target.blur();}});
$('initials').onclick=e=>{const button=e.target.closest('[data-remove]');if(!button||state.seeds.length<2)return;resetTime();state.seeds.splice(Number(button.dataset.remove),1);state.seedMeta.splice(Number(button.dataset.remove),1);state.selected=Math.min(state.selected,state.seeds.length-1);renderControls();rebuild();};
$('add-trajectory').onclick=()=>{const angle=state.seeds.length*2.39996,r=state.range*.65;addSeed(state.dim===2?[r*Math.cos(angle),r*Math.sin(angle)]:[r*Math.cos(angle),r*Math.sin(angle),r*Math.sin(angle*.7)]);};
for(const [id,key]of [['field-toggle','field'],['grid-toggle','grid'],['paths-toggle','paths']])$(id).onchange=e=>{state[key]=e.target.checked;draw();};
$('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);$('reset-view').onclick=()=>{state.hover=null;state.range=DEFAULT_RANGE;state.yaw=.65;state.pitch=.5;drawPhase();};$('play').onclick=play;$('restart').onclick=()=>{resetTime();draw();};$('timeline').oninput=e=>{pause();state.t=Number(e.target.value);draw();};$('speed').onchange=e=>{state.speed=Number(e.target.value);};
function setTimeInterval(start,end){
 if(start===null||end===null||start>=end){$('time-error').textContent='Enter times from −100 to 100, with start before end.';return false;}
 state.timeStart=start;state.timeEnd=end;resetTime();
 $('time-start').value=start;$('time-end').value=end;$('timeline').min=start;$('timeline').max=end;
 $('timeline').step=Math.min(.01,(end-start)/1000);$('time-error').textContent='';rebuild();return true;
}
for(const id of ['time-start','time-end']){
 $(id).addEventListener('change',()=>setTimeInterval(parseCoordinate($('time-start').value),parseCoordinate($('time-end').value)));
 $(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur();}});
}
$('chart-trajectory').onchange=e=>{state.selected=Number(e.target.value);drawChart();};
let drag=null;const canvas=$('phase-canvas');
function pointerPoint(e){
 const b=canvas.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.left+b.width||e.clientY<b.top||e.clientY>b.top+b.height)return null;
 const scale=Math.min(b.width,b.height)/(2*state.range),u=(e.clientX-b.left-b.width/2)/scale,v=(b.height/2-e.clientY+b.top)/scale;
 return state.dim===2?[u,v]:pointOnSlice(u,v,state.yaw,state.pitch,state.sliceAxis,state.sliceValue);
}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||drag)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,initialX:e.clientX,initialY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
 if(drag){if(e.pointerId!==drag.id)return;if(Math.hypot(e.clientX-drag.initialX,e.clientY-drag.initialY)>4)drag.moved=true;
  if(state.dim===3&&drag.moved){state.hover=null;state.yaw+=(e.clientX-drag.x)*.009;state.pitch=Math.max(-1.4,Math.min(1.4,state.pitch+(e.clientY-drag.y)*.009));drawPhase();}drag.x=e.clientX;drag.y=e.clientY;return;}
 const point=pointerPoint(e);state.hover=point?.every(v=>Math.abs(v)<=100)?point:null;drawPhase();
});
canvas.addEventListener('pointerup',e=>{
 if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;
 if(!moved){const point=pointerPoint(e);if(point)addSeed(point);else if(state.dim===3){const b=canvas.getBoundingClientRect();if(e.clientX>=b.left&&e.clientX<=b.left+b.width&&e.clientY>=b.top&&e.clientY<=b.top+b.height)$('placement-status').textContent='Rotate the view or choose another plane: this plane is edge-on.';}}
});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;});
canvas.addEventListener('pointerleave',()=>{state.hover=null;drawPhase();});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001));},{passive:false});
canvas.addEventListener('keydown',e=>{if(['+','=','-',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();state.hover=null;if(e.key===' ')play();else if(e.key==='+'||e.key==='=')zoom(.8);else if(e.key==='-')zoom(1.25);else if(state.dim===3){state.yaw+=(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0);state.pitch=Math.max(-1.4,Math.min(1.4,state.pitch+(e.key==='ArrowUp'?.12:e.key==='ArrowDown'?-.12:0)));drawPhase();}}});
$('slice-plane').onchange=e=>{state.sliceAxis=Number(e.target.value);state.hover=null;$('slice-axis-label').textContent='x'+'₁₂₃'[state.sliceAxis]+' =';$('placement-status').textContent='';drawPhase();};
$('slice-value').onchange=e=>{const value=parseCoordinate(e.target.value);if(value===null){e.target.value=String(state.sliceValue);$('placement-status').textContent='Use a plane coordinate between −100 and 100.';return;}state.sliceValue=value;e.target.value=String(value);state.hover=null;$('placement-status').textContent='';drawPhase();};
$('representative-points').onclick=()=>{resetTime();refreshRepresentativeSeeds(false);renderControls();rebuild();$('placement-status').textContent='Representative initial points restored for this matrix.';};
const tracePlane=createTraceDetPlane({canvas:$('trace-canvas'),values:$('trace-values'),status:$('trace-error'),follow:$('trace-follow'),reset:$('trace-reset'),onChange:(A,final)=>{
 if(state.dim!==2)return;
 const changed=A.some((row,i)=>row.some((v,j)=>v!==state.A[i][j]));
 if(!final&&!changed)return;
 const renderSeeds=changed&&keepInitialPoints();
 if(changed)updateTrackedPoints(A);
 pause();state.A=A;state.hover=null;$('preset').value='custom';$('matrix-error').textContent='';
 renderControls({renderSeeds});rebuild(final?1200:320);
}});
window.addEventListener('themechange',()=>{
 colors=plotPalette().colors;
 state.seeds.forEach((_,i)=>{$('seed-dot-'+i).style.background=colors[i%colors.length];});
 draw();tracePlane.draw();
});
refreshRepresentativeSeeds(false);
renderControls();rebuild();new ResizeObserver(draw).observe($('phase-canvas'));new ResizeObserver(drawChart).observe($('time-canvas'));
// Expose the same visible workflow to browsers supporting WebMCP.
if(document.modelContext?.registerTool){const lifecycle=new AbortController(),register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};register({name:'get_linear_system',title:'Read linear system',description:'Read the current matrix, initial conditions, time, and stability analysis.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({dimension:state.dim,matrix:state.A,initialConditions:state.seeds,initialPointLabels:state.seedMeta.map(s=>s.label),time:state.t,timeInterval:{start:state.timeStart,end:state.timeEnd},initialTime:0,phaseRange:{min:-state.range,max:state.range},analysis:analyze(state.A)})});register({name:'configure_linear_system',title:'Configure linear system',description:'Set a 2×2 or 3×3 real system matrix and initial conditions, then update the visible plots.',inputSchema:{type:'object',properties:{matrix:{type:'array',minItems:2,maxItems:3,items:{type:'array',minItems:2,maxItems:3,items:{type:'number',minimum:-20,maximum:20}}},initialConditions:{type:'array',minItems:1,maxItems:MAX_MANUAL_SEEDS,items:{type:'array',minItems:2,maxItems:3,items:{type:'number',minimum:-100,maximum:100}}}},required:['matrix','initialConditions'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{const A=input?.matrix,seeds=input?.initialConditions,n=A?.length;if(![2,3].includes(n)||!Array.isArray(A)||!A.every(r=>Array.isArray(r)&&r.length===n&&r.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=20))||!Array.isArray(seeds)||seeds.length<1||seeds.length>MAX_MANUAL_SEEDS||!seeds.every(s=>Array.isArray(s)&&s.length===n&&s.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=100)))throw new Error('Provide a square 2D or 3D matrix (−20…20) and 1–40 matching coordinate vectors (−100…100).');resetTime();state.A=A.map(r=>[...r]);state.dim=n;state.seeds=seeds.map(s=>[...s]);state.seedMeta=state.seeds.map(x=>({x,source:'manual',label:'Custom point · x(0)',components:null}));state.selected=0;state.range=DEFAULT_RANGE;$('preset').value='custom';renderControls();rebuild();return{dimension:n,trajectories:seeds.length,analysis:analyze(A)};}});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
