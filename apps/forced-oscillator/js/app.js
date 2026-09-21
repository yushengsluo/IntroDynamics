import {createSolution,frequencyResponse} from './oscillator.js';
import {createDuffingSolution,potential} from './duffing.js';

const $=id=>document.getElementById(id);
const colors={mint:'#61dfbd',orange:'#f6b77b',violet:'#b9a2ff',muted:'#8298af',grid:'#24354a',axis:'#466079'};
const presets={
 damped:{b:.4,k:1,omega:.8},near:{b:.08,k:1,omega:1},
 beats:{b:0,k:1,omega:1.15},resonance:{b:0,k:1,omega:1},
 critical:{b:2,k:1,omega:.8},overdamped:{b:4,k:1,omega:.8},
 'duffing-hardening':{b:.3,k:1,beta:1,omega:1.2},
 'duffing-double-well':{b:.25,k:-1,beta:1,omega:1.2,x0:.5},
 'duffing-softening':{b:.4,k:2,beta:-.2,omega:.8},
 'duffing-chaos':{b:.3,k:-1,beta:.25,omega:1.2,x0:2.6,v0:0}
};
const bounds={b:[0,10],k:[.1,25],beta:[-5,5],omega:[0,10],x0:[-1e6,1e6],v0:[-1e6,1e6],'start-time':[-500,500],duration:[-500,500]};
const names={b:'Damping',k:'Stiffness',beta:'Cubic stiffness',omega:'Driving frequency',x0:'Initial position',v0:'Initial velocity','start-time':'Start time',duration:'End time'};
let parameters={...presets.damped,beta:1,x0:0,v0:0},startTime=0,endTime=40,time=0,speed=1,playing=false,model='harmonic';
const savedParameters={harmonic:null,duffing:null};
let solution,points,forcingPoints,xRange=1,vRange=1,needsBuild=true,scheduled=false,lastFrame=null;
const trajectoryColors=[colors.mint,'#7fbfff','#f58ca5','#e5d179','#d29ef6','#8fd59a','#f6b77b','#9eb2ff','#e8a5d1','#8bd5dd','#cadb91','#cab39c'];
const MAX_TRAJECTORIES=12,curveCache=new Map();
let nextTrajectoryId=1,trajectories=[],activeId;
const activeTrajectory=()=>trajectories.find(trajectory=>trajectory.id===activeId);
function makeTrajectory(x0,v0){
 const id=nextTrajectoryId++;
 const color=trajectoryColors.find(color=>!trajectories.some(trajectory=>trajectory.color===color))??colors.mint;
 return {id,x0,v0,color};
}
function resetTrajectories(){
 nextTrajectoryId=1;trajectories=[];
 const first=makeTrajectory(parameters.x0,parameters.v0);trajectories.push(first);activeId=first.id;
}
resetTrajectories();
const canvases=['motion','phase','time','response'].map(name=>$(name+'-canvas'));
const fmt=(n,d=2)=>Number.isFinite(n)?(Math.abs(n)<.5*10**-d?0:n).toFixed(d):'—';

function schedule(rebuild=false){
 needsBuild ||= rebuild;
 if(!scheduled){scheduled=true;requestAnimationFrame(frame);}
}
function setPlaying(value){
 playing=value;lastFrame=null;
 $('play').textContent=playing?'Ⅱ Pause':'▶ Play';
 $('play').setAttribute('aria-label',playing?'Pause animation':'Play animation');
 schedule();
}
function frame(timestamp){
 scheduled=false;
 if(needsBuild){rebuild();needsBuild=false;}
 if(playing&&lastFrame!==null)time=Math.min(endTime,time+Math.max(0,Math.min(.1,(timestamp-lastFrame)/1000))*speed);
 lastFrame=playing?timestamp:null;
 if(time>=endTime&&playing)setPlaying(false);
 render();
 if(playing)schedule();
}
function rebuild(){
 curveCache.clear();
 let maxX=.5,maxV=.5;const limits=[];let clipped=false;
 for(const trajectory of trajectories){
  const key=[model,parameters.b,parameters.k,parameters.beta,parameters.omega,trajectory.x0,trajectory.v0].join(',');
  const windowKey=startTime+','+endTime;
  if(trajectory.key!==key){
   trajectory.solution=(model==='duffing'?createDuffingSolution:createSolution)({...parameters,x0:trajectory.x0,v0:trajectory.v0});
   trajectory.key=key;trajectory.windowKey=null;
  }
  if(trajectory.windowKey!==windowKey){trajectory.points=trajectory.solution.sampleInterval(startTime,endTime);trajectory.windowKey=windowKey;}
  maxX=Math.max(maxX,Math.abs(trajectory.x0));maxV=Math.max(maxV,Math.abs(trajectory.v0));
  for(const point of trajectory.points){
   if(point.clipped){clipped=true;continue;}
   maxX=Math.max(maxX,Math.abs(point.x));maxV=Math.max(maxV,Math.abs(point.v));
  }
  const failures=(trajectory.solution.limits?.()??[]).filter(limit=>limit.direction<0?startTime<limit.t:endTime>limit.t);
  if(failures.length)limits.push('Trajectory '+trajectory.id+': '+failures.map(limit=>'t ≈ '+fmt(limit.t)).join(', '));
 }
 ({solution,points}=activeTrajectory());
 // The applied force remains defined even beyond a truncated numerical trajectory.
 const forceCount=Math.min(20000,Math.max(400,Math.ceil((endTime-startTime)*parameters.omega*8)));
 forcingPoints=Array.from({length:forceCount+1},(_,i)=>{const t=i===forceCount?endTime:startTime+(endTime-startTime)*i/forceCount;return {t,force:Math.cos(parameters.omega*t)};});
 // Finite-time trajectories remain continuous even where the periodic amplitude diverges.
 xRange=1.12*maxX;vRange=1.12*maxV;
 $('range-note').textContent=limits.length?'Numerical trajectory stops at the calculation limit. '+limits.join('; ')+'. Rapid growth or fast oscillations exceeded the limit; finite portions remain visible. Try a shorter interval or smaller initial values.':clipped?'Backward-time growth exceeds the plotting limit. States above 10¹⁰⁰ are omitted; later finite states remain visible.':'';
 updateTrajectoryControls();
 updateExplanation();
}
function updateExplanation(){
 const {b,k,omega}=parameters,{response,naturalFrequency,regime}=solution;
 $('regime').textContent=regime;
 $('force-legend').hidden=!$('show-force').checked;
 if(model==='duffing'){
  const beta=parameters.beta;
  $('natural-frequency').textContent=omega===0?'Constant force':fmt(2*Math.PI/omega,3);
  $('particular-legend').hidden=true;
  $('insight').textContent=beta===0?'The cubic term is zero, leaving a linear forced equation. Positive k gives a restoring spring; negative k makes the origin unstable without the drive.'
   :beta>0&&k<0?'The unforced potential has two wells, centered at x = ±'+fmt(Math.sqrt(-k/beta),3)+'. The drive can move the oscillator within a well or across the barrier. Initial conditions can change its response.'
   :beta>0?'Positive cubic stiffness strengthens the restoring force at larger displacements. The oscillation frequency depends on amplitude, so the driven response need not be sinusoidal.'
   :'Negative cubic stiffness weakens the restoring force at larger displacements. The potential falls without bound far from the origin, so some initial conditions escape instead of settling.';
  $('comparison-note').textContent=beta===0?'With β = 0 the cubic term vanishes. The potential plot shows the resulting linear restoring term.':'Duffing dynamics are computed numerically. Long-time motion can be sensitive to initial conditions; the harmonic periodic-response formula does not apply.';
  if($('preset').value==='duffing-chaos'){
   $('regime').textContent='Chaotic double well';
   $('insight').textContent='Watch the irregular switching between the two wells. These two trajectories start only 0.00001 apart at t = 0, so their moving dots overlap at first before their paths separate. Both trails animate together. Select either trajectory to follow it in the motion panel.';
   $('comparison-note').textContent='Chaotic Duffing example: b = 0.3, k = −1, β = 0.25, ω = 1.2. Colors identify separate initial conditions. Long-time paths are sensitive to both initial values and numerical error.';
  }
  return;
 }
 $('natural-frequency').textContent=fmt(naturalFrequency,3);
 $('response-amplitude').textContent=response.resonant?'Unbounded at resonance':response.amplitude>999?response.amplitude.toExponential(2):fmt(response.amplitude,3);
 $('phase-lag').textContent=response.phase===null?'—':fmt(response.phase,3)+' rad';
 let insight,comparison;
 if(response.resonant){
  insight='The drive matches the natural frequency with no damping. Each cycle adds energy, so the oscillation envelope grows linearly with time. There is no bounded periodic response.';
  comparison='Exact undamped resonance: no bounded periodic response exists. The plotted solution remains finite over this time window.';
 }else if(omega===0){
  insight=b>0?'The force is constant: cos(0t) = 1. The mass approaches the displaced equilibrium x = 1/k as the transient decays.':'The force is constant. With no damping, the mass oscillates about the displaced equilibrium x = 1/k.';
  comparison='The comparison is the constant particular solution x = 1/k.';
 }else if(b===0){
  insight='With no damping, the natural oscillation persists alongside the driven motion. Nearby frequencies produce beats: a slowly rising and falling amplitude envelope.';
  comparison='The dashed comparison is a periodic particular solution. Free oscillations persist, so the total motion need not approach it.';
 }else{
  insight=Math.abs(omega-naturalFrequency)<.15*naturalFrequency&&b<.5*naturalFrequency
   ?'The drive is near the natural frequency. Small damping allows a large response; the initial transient fades as the motion approaches the driving frequency.'
   :regime==='Critically damped'
    ?'The unforced system is at the boundary between oscillatory and nonoscillatory decay. Here the periodic force keeps the mass moving after the initial transient fades.'
    :regime==='Overdamped'
     ?'Strong damping suppresses free oscillations. The transient decays without oscillation, while the continuing drive produces a smaller, phase-delayed periodic response.'
     :'The initial motion combines a decaying natural oscillation with the driven response. After the transient fades, the mass oscillates at the driving frequency with a phase lag.';
  comparison='The dashed comparison is the periodic response approached as the transient decays.';
 }
 if(!response.resonant&&response.amplitude>xRange*1.5)comparison+=' The comparison may extend beyond the plotted displacement range.';
 $('insight').textContent=insight;$('comparison-note').textContent=comparison;
 $('force-legend').hidden=!$('show-force').checked;
 $('particular-legend').hidden=!$('show-particular').checked||response.resonant;
}

function surface(canvas){
 const {width:w,height:h}=canvas.getBoundingClientRect();
 if(w<=0||h<=0)return null;
 const ratio=Math.min(window.devicePixelRatio||1,3),width=Math.round(w*ratio),height=Math.round(h*ratio);
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
 ctx.font='10px system-ui, sans-serif';ctx.lineWidth=1;ctx.setLineDash([]);
 return {ctx,w,h};
}
function line(ctx,x1,y1,x2,y2,color,width=1){
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
}
function dot(ctx,x,y,color,r=4){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fill();}
function arrow(ctx,x,y,dx,dy,color,width=1){
 const length=Math.hypot(dx,dy);if(length<.2)return;
 const ux=dx/length,uy=dy/length,head=Math.min(5,length*.4);
 line(ctx,x,y,x+dx,y+dy,color,width);
 ctx.beginPath();ctx.moveTo(x+dx-ux*head-uy*head*.5,y+dy-uy*head+ux*head*.5);
 ctx.lineTo(x+dx,y+dy);ctx.lineTo(x+dx-ux*head+uy*head*.5,y+dy-uy*head-ux*head*.5);ctx.stroke();
}
function ticks(low,high,target=5){
 const raw=(high-low)/target,power=10**Math.floor(Math.log10(raw));
 const scaled=raw/power,step=(scaled<=1?1:scaled<=2?2:scaled<=5?5:10)*power;
 const result=[];for(let i=Math.ceil(low/step);i*step<=high+step*1e-8&&result.length<30;i++)result.push(i*step);
 return result;
}
function tickLabel(n){return n===0?'0':Math.abs(n)<.01||Math.abs(n)>=10000?n.toExponential(0):String(+n.toPrecision(4));}
function plot(ctx,w,h,{xmin,xmax,ymin,ymax,xlabel,ylabel,log=false}){
 const left=48,right=w-20,top=24,bottom=h-31;
 const X=x=>left+(x-xmin)/(xmax-xmin)*(right-left),Y=y=>bottom-(y-ymin)/(ymax-ymin)*(bottom-top);
 ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle=colors.muted;
 for(const x of ticks(xmin,xmax,w<400?4:7)){line(ctx,X(x),top,X(x),bottom,colors.grid);ctx.fillText(tickLabel(x),X(x),bottom+7);}
 ctx.textAlign='right';ctx.textBaseline='middle';
 for(const y of log?[-2,-1,0,1,2,3]:ticks(ymin,ymax,4)){
  line(ctx,left,Y(y),right,Y(y),colors.grid);ctx.fillText(log?['0.01','0.1','1','10','100','1k'][y+2]:tickLabel(y),left-8,Y(y));
 }
 if(ymin<=0&&ymax>=0)line(ctx,left,Y(0),right,Y(0),colors.axis);
 if(xmin<=0&&xmax>=0)line(ctx,X(0),top,X(0),bottom,colors.axis);
 ctx.fillStyle='#adbdce';ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText(xlabel,right,h-13);
 ctx.textAlign='left';ctx.fillText(ylabel,12,5);
 return {X,Y,left,right,top,bottom};
}
function clip(ctx,p,draw){ctx.save();ctx.beginPath();ctx.rect(p.left,p.top,p.right-p.left,p.bottom-p.top);ctx.clip();draw();ctx.restore();}
function curve(ctx,data,X,Y,value,color,{width=1.5,dash=[],end=Infinity,cacheKey=null}={}){
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);
 const cached=cacheKey&&typeof Path2D!=='undefined';
 let path=cached?curveCache.get(cacheKey):null;
 if(!path){
  path=cached?new Path2D():ctx;if(!cached)ctx.beginPath();let started=false;
  for(const p of data){if(p.t>end)break;const y=value(p);if(!Number.isFinite(y)){started=false;continue;}const x=X(p),py=Y(y);if(!Number.isFinite(x)||!Number.isFinite(py)){started=false;continue;}if(started)path.lineTo(x,py);else{path.moveTo(x,py);started=true;}}
  if(cached)curveCache.set(cacheKey,path);
 }
 if(cached)ctx.stroke(path);else ctx.stroke();ctx.setLineDash([]);
}
function drawMotion(s,current){
 if(current.clipped){s.ctx.fillStyle=colors.muted;s.ctx.textAlign='center';s.ctx.fillText('State exceeds the plotting limit at this time',s.w/2,s.h/2);return;}
 const {ctx,w,h}=s,wall=25,center=w*.66,travel=Math.max(20,w*.17),massX=center+current.x/xRange*travel,cy=h*.51;
 ctx.fillStyle='#1b2c40';ctx.fillRect(14,cy-52,11,100);
 for(let y=cy-51;y<cy+49;y+=9)line(ctx,14,y,23,y-6,'#526780');
 line(ctx,wall,cy+43,w-18,cy+43,'#3a5069');
 ctx.setLineDash([3,4]);line(ctx,center,cy-71,center,cy+60,'#3e586b');ctx.setLineDash([]);
 const edge=massX-22,start=wall+15,end=edge-10,sy=cy-15;
 ctx.strokeStyle=colors.mint;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(wall,sy);ctx.lineTo(start,sy);
 for(let i=0;i<=16;i++)ctx.lineTo(start+(end-start)*i/16,sy+(i===0||i===16?0:i%2?8:-8));
 ctx.lineTo(edge,sy);ctx.stroke();
 const dy=cy+20,damper=wall+(edge-wall)*.48;
 line(ctx,wall,dy,damper-13,dy,'#6d8ba5',1.6);ctx.strokeStyle='#6d8ba5';ctx.strokeRect(damper-13,dy-7,27,14);
 line(ctx,damper+7,dy-5,damper+7,dy+5,'#9cb5c9',2);line(ctx,damper+7,dy,edge,dy,'#9cb5c9',1.6);
 ctx.fillStyle='#1d4744';ctx.fillRect(edge,cy-32,44,67);ctx.strokeStyle=colors.mint;ctx.lineWidth=1.5;ctx.strokeRect(edge,cy-32,44,67);
 ctx.fillStyle='#bcefe0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='12px system-ui, sans-serif';ctx.fillText('m = 1',massX,cy);
 dot(ctx,massX-12,cy+39,'#8ba7b8',4);dot(ctx,massX+12,cy+39,'#8ba7b8',4);
 arrow(ctx,massX,cy-51,Math.min(36,w*.09)*current.force,0,colors.orange,2);
 ctx.fillStyle=colors.orange;ctx.font='10px system-ui, sans-serif';ctx.fillText('cos(ωt)',massX,cy-72);
 ctx.fillStyle=colors.muted;ctx.fillText('0',center,cy+67);ctx.fillText(model==='duffing'?'k, β':'k',wall+(edge-wall)*.38,sy-19);ctx.fillText('b',damper,dy+18);
}
function drawPhase(s,current){
 const {ctx,w,h}=s,p=plot(ctx,w,h,{xmin:-xRange,xmax:xRange,ymin:-vRange,ymax:vRange,xlabel:'x',ylabel:'x′'});
 clip(ctx,p,()=>{
  if($('show-field').checked){
   for(let i=-5;i<=5;i++)for(let j=-4;j<=4;j++){
    const x=i*xRange/5.6,v=j*vRange/4.6,dx=v/xRange*(p.right-p.left),dy=-(current.force-parameters.b*v-parameters.k*x-(model==='duffing'?parameters.beta*x*x*x:0))/vRange*(p.bottom-p.top);
    const length=Math.hypot(dx,dy);if(length<1e-10)continue;
    const scale=Math.min(12,(p.right-p.left)/20)/length;
    arrow(ctx,p.X(x)-dx*scale/2,p.Y(v)-dy*scale/2,dx*scale,dy*scale,'#39546b');
   }
  }
  for(const trajectory of trajectories){
   ctx.globalAlpha=.22;
   curve(ctx,trajectory.points,q=>p.X(q.x),p.Y,q=>q.v,trajectory.color,{width:1.3,cacheKey:'phase-'+trajectory.id});
  }
  ctx.globalAlpha=1;
  const states=trajectories.map(trajectory=>trajectory.id===activeId?current:trajectory.solution.at(time));
  // Selection controls the readouts, not which trajectories advance. Only the
  // faint full-window paths are cached; each bright trail follows the clock.
  for(let i=0;i<trajectories.length;i++){
   const {points:history,color}=trajectories[i],state=states[i];
   let lower=0,upper=history.length-1;
   while(lower<upper){const middle=Math.ceil((lower+upper)/2);if(history[middle].t<=time)lower=middle;else upper=middle-1;}
   curve(ctx,history,q=>p.X(q.x),p.Y,q=>q.v,color,{width:2,end:time});
   const previous=history[lower];
   if(!previous.clipped&&!state.clipped)line(ctx,p.X(previous.x),p.Y(previous.v),p.X(state.x),p.Y(state.v),color,2);
  }
  for(const trajectory of trajectories){
   ctx.strokeStyle=trajectory.color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.X(trajectory.x0),p.Y(trajectory.v0),4,0,2*Math.PI);ctx.stroke();
  }
  for(let i=0;i<trajectories.length;i++){
   const trajectory=trajectories[i],state=states[i];
   if(!state.clipped){
    dot(ctx,p.X(state.x),p.Y(state.v),'#101c2b',trajectory.id===activeId?8:7);
    dot(ctx,p.X(state.x),p.Y(state.v),trajectory.color,4);
   }
  }
 });
}
function drawTime(s,current){
 const {ctx,w,h}=s,range=Math.max(xRange,$('show-force').checked?1.12:0),p=plot(ctx,w,h,{xmin:startTime,xmax:endTime,ymin:-range,ymax:range,xlabel:'t',ylabel:'x, F'});
 clip(ctx,p,()=>{
  if($('show-force').checked)curve(ctx,forcingPoints,q=>p.X(q.t),p.Y,q=>q.force,colors.orange,{width:1,dash:[4,5],cacheKey:'force'});
  if(model==='harmonic'&&$('show-particular').checked&&!solution.response.resonant)curve(ctx,points,q=>p.X(q.t),p.Y,q=>solution.particular(q.t),colors.violet,{width:1.2,dash:[6,5],cacheKey:'particular'});
  for(const trajectory of trajectories){
   ctx.globalAlpha=trajectory.id===activeId?1:.6;
   curve(ctx,trajectory.points,q=>p.X(q.t),p.Y,q=>q.x,trajectory.color,{width:trajectory.id===activeId?1.8:1.2,cacheKey:'time-'+trajectory.id});
  }
  ctx.globalAlpha=1;
  ctx.setLineDash([3,4]);line(ctx,p.X(time),p.top,p.X(time),p.bottom,'#9ac0b4');ctx.setLineDash([]);
  if(!current.clipped)dot(ctx,p.X(time),p.Y(current.x),activeTrajectory().color,4);
 });
}
function drawPotential(s,current){
 const {ctx,w,h}=s,{k,beta}=parameters;
 const well=k<0&&beta>0?Math.sqrt(-k/beta):0,extent=Math.max(2,Math.min(8,xRange),Math.min(30,well*1.6));
 const values=Array.from({length:401},(_,i)=>{const x=-extent+2*extent*i/400;return {t:x,y:potential(k,beta,x)};});
 const low=Math.min(0,...values.map(p=>p.y)),high=Math.max(0,...values.map(p=>p.y)),padding=Math.max(.1,(high-low)*.12);
 const p=plot(ctx,w,h,{xmin:-extent,xmax:extent,ymin:low-padding,ymax:high+padding,xlabel:'x',ylabel:'V(x)'});
 clip(ctx,p,()=>{
  curve(ctx,values,q=>p.X(q.t),p.Y,q=>q.y,colors.violet,{width:2});
  if(well>0&&well<=extent)for(const x of [-well,well])dot(ctx,p.X(x),p.Y(potential(k,beta,x)),'#b9cbda',3);
  if(!current.clipped&&Math.abs(current.x)<=extent){
   ctx.setLineDash([3,4]);line(ctx,p.X(current.x),p.top,p.X(current.x),p.bottom,'#689e8f');ctx.setLineDash([]);
   dot(ctx,p.X(current.x),p.Y(potential(k,beta,current.x)),colors.mint,4);
  }
 });
}
function drawResponse(s,current){
 if(model==='duffing'){drawPotential(s,current);return;}
 const {ctx,w,h}=s,maxOmega=Math.max(3,2*solution.naturalFrequency,parameters.omega*1.2),p=plot(ctx,w,h,{xmin:0,xmax:maxOmega,ymin:-2,ymax:3,xlabel:'Ω',ylabel:'R',log:true});
 clip(ctx,p,()=>{
  const natural=solution.naturalFrequency;
  if(parameters.b===0){ctx.setLineDash([3,5]);line(ctx,p.X(natural),p.top,p.X(natural),p.bottom,'#526078');ctx.setLineDash([]);}
  // Sample densely around narrow resonances so low damping never hides the peak.
  const frequencies=Array.from({length:501},(_,i)=>i*maxOmega/500);
  for(const offset of [0,.00001,.0001,.001,.005,.01,.025,.05,.1,.2])for(const sign of [-1,1]){
   const value=natural+sign*offset;if(value>=0&&value<=maxOmega)frequencies.push(value);
  }
  frequencies.sort((a,b)=>a-b);
  ctx.strokeStyle=colors.violet;ctx.lineWidth=1.8;ctx.beginPath();let previous=null;
  for(const omega of frequencies){
   const amplitude=frequencyResponse(parameters.b,parameters.k,omega).amplitude;
   if(!Number.isFinite(amplitude)){previous=null;continue;}
   const x=p.X(omega),y=p.Y(Math.log10(amplitude));
   if(previous===null)ctx.moveTo(x,y);else ctx.lineTo(x,y);previous=omega;
  }
  ctx.stroke();ctx.setLineDash([3,4]);line(ctx,p.X(parameters.omega),p.top,p.X(parameters.omega),p.bottom,'#689e8f');ctx.setLineDash([]);
  dot(ctx,p.X(parameters.omega),p.Y(Math.min(3,Math.max(-2,Math.log10(solution.response.amplitude)))),colors.mint,4);
 });
 ctx.textAlign='right';ctx.textBaseline='top';ctx.fillStyle=colors.mint;ctx.fillText('ω = '+fmt(parameters.omega),p.right,p.top+5);
}
function render(){
 const current=solution.at(time);
 $('current-x').textContent=fmt(current.x,3);$('current-v').textContent=fmt(current.v,3);$('current-force').textContent=fmt(current.force,3);
 $('time-label').textContent='t = '+fmt(time);$('timeline').value=String(time);
 if(model==='duffing'){
  $('response-amplitude').textContent=current.clipped?'—':fmt(current.v*current.v/2+potential(parameters.k,parameters.beta,current.x),3);
  $('phase-lag').textContent=current.clipped?'—':fmt(current.v*current.force-parameters.b*current.v*current.v,3);
 }
 [drawMotion,drawPhase,drawTime,drawResponse].forEach((draw,i)=>{const s=surface(canvases[i]);if(s)draw(s,current);});
}

function validate(){
 let error='';
 for(const [key,[min,max]] of Object.entries(bounds)){
  if(key==='beta'&&model==='harmonic')continue;
  const input=$(key),value=Number(input.value),valid=input.value.trim()!==''&&Number.isFinite(value)&&value>=min&&value<=max;
  input.setAttribute('aria-invalid',String(!valid));
  if(!valid&&!error)error=names[key]+' must be between '+min+' and '+max+'.';
 }
 if(!error&&Number($('start-time').value)>=Number($('duration').value)){
  error='Start time must be less than end time.';
  $('start-time').setAttribute('aria-invalid','true');$('duration').setAttribute('aria-invalid','true');
 }
 $('input-error').textContent=error;
}
function updateTimeControls(syncInputs=false){
 if(syncInputs){$('start-time').value=String(startTime);$('duration').value=String(endTime);}
 $('timeline').min=String(startTime);$('timeline').max=String(endTime);
 $('timeline').step=String(Math.min(.01,(endTime-startTime)/1000));
}
function updateTrajectoryControls(){
 const initialLabel=value=>String(+value.toPrecision(7));
 $('trajectory-select').innerHTML=trajectories.map(trajectory=>'<option value="'+trajectory.id+'">'+trajectory.id+' · ('+initialLabel(trajectory.x0)+', '+initialLabel(trajectory.v0)+')</option>').join('');
 $('trajectory-select').value=String(activeId);
 $('trajectory-count').textContent=trajectories.length+' / '+MAX_TRAJECTORIES;
 $('trajectory-legend').innerHTML=trajectories.map(trajectory=>'<span class="trajectory-chip'+(trajectory.id===activeId?' selected':'')+'" style="--trajectory-color:'+trajectory.color+'">'+(trajectory.id===activeId?'● ':'')+'Trajectory '+trajectory.id+'</span>').join('');
 $('selected-trajectory').textContent='Following trajectory '+activeId;
 $('add-trajectory').disabled=trajectories.length>=MAX_TRAJECTORIES;
 $('remove-trajectory').disabled=trajectories.length===1;
 $('keep-trajectory').disabled=trajectories.length===1;
}
function selectTrajectory(id){
 const trajectory=trajectories.find(trajectory=>trajectory.id===id);if(!trajectory)return;
 activeId=id;parameters.x0=trajectory.x0;parameters.v0=trajectory.v0;
 $('x0').value=String(trajectory.x0);$('v0').value=String(trajectory.v0);
 updateTrajectoryControls();validate();schedule(true);
}
function addTrajectory(x0,v0){
 if(trajectories.length>=MAX_TRAJECTORIES){$('trajectory-status').textContent='All 12 trajectory slots are in use. Remove one to add another.';return;}
 if(![x0,v0].every(value=>Number.isFinite(value)&&Math.abs(value)<=1e6)){
  $('trajectory-status').textContent='This point exceeds the initial-value limit of ±1,000,000. Use a smaller time window to reduce the plot scale.';return;
 }
 const trajectory=makeTrajectory(x0,v0);trajectories.push(trajectory);selectTrajectory(trajectory.id);
 $('preset').value='custom';
 $('trajectory-status').textContent='Added trajectory '+trajectory.id+' at t = 0. Its values are selected for editing.';
 time=Math.min(endTime,Math.max(startTime,0));setPlaying(false);
}
function edit(key,value){
 const [min,max]=bounds[key];if(value.trim()===''||!Number.isFinite(Number(value))||Number(value)<min||Number(value)>max)return;
 if(key==='duration'||key==='start-time'){
  const start=$('start-time').value.trim(),end=$('duration').value.trim(),a=Number(start),b=Number(end);
  if(!start||!end||![a,b].every(t=>Number.isFinite(t)&&t>=-500&&t<=500)||a>=b){validate();return;}
  startTime=a;endTime=b;time=Math.min(endTime,Math.max(startTime,time));lastFrame=null;
  updateTimeControls();
 }
 else{
  parameters[key]=Number(value);
  if(key==='x0'||key==='v0')activeTrajectory()[key]=Number(value);
  $('preset').value='custom';if($(key+'-slider'))$(key+'-slider').value=value;
 }
 validate();schedule(true);
}
for(const key of Object.keys(bounds)){
 $(key).addEventListener('input',event=>edit(key,event.target.value));
 $(key).addEventListener('change',validate);
 const slider=$(key+'-slider');if(slider)slider.addEventListener('input',()=>{$(key).value=slider.value;edit(key,slider.value);});
}
function applyPreset(name){
 if(!presets[name])return;
 savedParameters[model]={...parameters};model=name.startsWith('duffing-')?'duffing':'harmonic';
 parameters={beta:1,x0:0,v0:0,...presets[name]};
 resetTrajectories();
 if(name==='duffing-chaos'){
  trajectories.push(makeTrajectory(parameters.x0+.00001,parameters.v0));
  startTime=0;endTime=250;
 }
 time=startTime;$('trajectory-status').textContent='';
 updateModelControls();syncParameterInputs();
 updateTimeControls(true);$('preset').value=name;
 validate();setPlaying(false);schedule(true);
}
function syncParameterInputs(){
 for(const [key,value] of Object.entries(parameters)){$(key).value=String(value);if($(key+'-slider'))$(key+'-slider').value=String(value);}
}
function updateModelControls(){
 const nonlinear=model==='duffing';
 bounds.k=nonlinear?[-10,25]:[.1,25];
 $('k').min=String(bounds.k[0]);$('k-slider').min=String(bounds.k[0]);
 $('model').value=model;$('beta-control').hidden=!nonlinear;$('beta').disabled=!nonlinear;$('beta-slider').disabled=!nonlinear;
 $('particular-control').hidden=nonlinear;$('show-particular').disabled=nonlinear;
 $('equation').textContent=nonlinear?'x″ + bx′ + kx + βx³ = cos(ωt)':'x″ + bx′ + kx = cos(ωt)';
 $('page-title').textContent=nonlinear?'Duffing oscillator':'Damped, forced oscillator';
 $('model-note').textContent=nonlinear?'Second-order nonlinear ODE':'Second-order linear ODE';
 $('response-heading').textContent=nonlinear?'Unforced potential':'Frequency response';
 $('response-subtitle').textContent=nonlinear?'V(x) = ½kx² + ¼βx⁴':'Amplitude · log scale';
 $('response-note').textContent=nonlinear?'Spring potential only; the external drive and damping act separately. The dot shows the current position.':'Same b and k, varying drive Ω. Amplitudes above 10³ are clipped.';
 $('response-canvas').setAttribute('aria-label',nonlinear?'Unforced Duffing potential versus displacement, with the current position marked':'Periodic response amplitude versus driving frequency, with the current frequency marked');
 $('time-canvas').setAttribute('aria-label',nonlinear?'Duffing displacement and driving force over time':'Displacement, driving force, and periodic particular response over time');
 $('frequency-label').textContent=nonlinear?'Forcing period 2π/ω':'Natural frequency √k';
 $('amplitude-label').textContent=nonlinear?'Mechanical energy E(t)':'Periodic amplitude';
 $('phase-label').textContent=nonlinear?'Energy change dE/dt':'Phase lag';
 $('response-formula').textContent=nonlinear?'E = ½(x′)² + V(x)':'R = 1 / √((k − ω²)² + b²ω²)';
}
$('model').addEventListener('change',()=>{
 const next=$('model').value;if(!['harmonic','duffing'].includes(next)||next===model)return;
 savedParameters[model]={...parameters};model=next;
 parameters=savedParameters[model]?{...savedParameters[model]}:{...parameters,beta:1,k:model==='harmonic'?Math.max(.1,parameters.k):parameters.k};
 parameters.x0=activeTrajectory().x0;parameters.v0=activeTrajectory().v0;
 updateModelControls();syncParameterInputs();$('preset').value='custom';validate();schedule(true);
});
$('preset').addEventListener('change',()=>applyPreset($('preset').value));
$('reset').addEventListener('click',()=>{
 for(const id of ['show-force','show-particular','show-field'])$(id).checked=true;
 speed=1;$('speed').value='1';startTime=0;endTime=40;applyPreset('damped');
});
$('play').addEventListener('click',()=>{if(time>=endTime)time=startTime;setPlaying(!playing);});
$('restart').addEventListener('click',()=>{time=startTime;setPlaying(false);});
$('timeline').addEventListener('input',()=>{time=Math.min(endTime,Math.max(startTime,Number($('timeline').value)));lastFrame=null;schedule();});
$('speed').addEventListener('change',()=>{speed=Number($('speed').value);});
$('trajectory-select').addEventListener('change',()=>selectTrajectory(Number($('trajectory-select').value)));
$('add-trajectory').addEventListener('click',()=>addTrajectory(parameters.x0,parameters.v0));
$('remove-trajectory').addEventListener('click',()=>{
 if(trajectories.length===1)return;
 trajectories=trajectories.filter(trajectory=>trajectory.id!==activeId);selectTrajectory(trajectories[0].id);
 $('preset').value='custom';$('trajectory-status').textContent='Selected trajectory removed.';
});
$('keep-trajectory').addEventListener('click',()=>{
 trajectories=[activeTrajectory()];$('preset').value='custom';$('trajectory-status').textContent='Only the selected trajectory remains.';schedule(true);
});
let phasePointer=null;
$('phase-canvas').addEventListener('pointerdown',event=>{phasePointer={x:event.clientX,y:event.clientY};});
$('phase-canvas').addEventListener('pointercancel',()=>{phasePointer=null;});
$('phase-canvas').addEventListener('click',event=>{
 const dragged=phasePointer&&Math.hypot(event.clientX-phasePointer.x,event.clientY-phasePointer.y)>6;phasePointer=null;
 if(event.button>0||dragged||!solution)return;
 const rect=$('phase-canvas').getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
 const left=48,right=rect.width-20,top=24,bottom=rect.height-31;
 if(right<=left||bottom<=top||x<left||x>right||y<top||y>bottom)return;
 addTrajectory(Number(((2*(x-left)/(right-left)-1)*xRange).toPrecision(8)),Number(((1-2*(y-top)/(bottom-top))*vRange).toPrecision(8)));
});
for(const id of ['show-force','show-particular','show-field'])$(id).addEventListener('change',()=>{curveCache.clear();updateExplanation();schedule();});
document.addEventListener('visibilitychange',()=>{lastFrame=null;});
const onResize=()=>{curveCache.clear();schedule();};
new ResizeObserver(onResize).observe(document.querySelector('main'));
window.addEventListener('resize',onResize);
updateModelControls();
schedule(true);
