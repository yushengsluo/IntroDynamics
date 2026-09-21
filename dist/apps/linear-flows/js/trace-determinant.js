import {plotPalette} from './palette.js';
const DEFAULT_BOUNDS={tMin:-6,tMax:6,dMin:-6,dMax:10};
export const defaultTraceBounds=()=>({...DEFAULT_BOUNDS});

// One continuous representative family; trace/determinant do not specify a unique matrix.
export function matrixFromTraceDet(t,d){
 if(!Number.isFinite(t)||!Number.isFinite(d)||Math.abs(t)>40||d<20*Math.abs(t)-800-1e-9||d>t*t/4+400+1e-9)return null;
 const half=t/2,r=d-half*half,h=Math.sqrt(Math.max(0,-r-400)),u=r+h*h,b=Math.max(1,Math.abs(u)/20);
 return [[half+h,-b],[u/b,half-h]].map(row=>row.map(v=>Math.max(-20,Math.min(20,v))));
}

export function tracePlot(width,height,bounds){
 const left=42,top=26,right=width-14,bottom=height-38;
 return{left,top,right,bottom,width:right-left,height:bottom-top,
  project:(t,d)=>[left+(t-bounds.tMin)/(bounds.tMax-bounds.tMin)*(right-left),bottom-(d-bounds.dMin)/(bounds.dMax-bounds.dMin)*(bottom-top)]};
}

export function tracePoint(x,y,width,height,bounds,{clamp=false,snap=true}={}){
 const plot=tracePlot(width,height,bounds);
 if(plot.width<=0||plot.height<=0||(!clamp&&(x<plot.left||x>plot.right||y<plot.top||y>plot.bottom)))return null;
 x=Math.max(plot.left,Math.min(plot.right,x));y=Math.max(plot.top,Math.min(plot.bottom,y));
 let t=bounds.tMin+(x-plot.left)/plot.width*(bounds.tMax-bounds.tMin),d=bounds.dMin+(plot.bottom-y)/plot.height*(bounds.dMax-bounds.dMin);
 if(snap){
  if(Math.abs(plot.project(0,d)[0]-x)<5)t=0;
  if(Math.abs(plot.project(t,0)[1]-y)<5)d=0;
  else if(Math.abs(plot.project(t,t*t/4)[1]-y)<5)d=t*t/4;
 }
 return{t,d};
}

export function fitTraceBounds(bounds,t,d){
 if(t>=bounds.tMin&&t<=bounds.tMax&&d>=bounds.dMin&&d<=bounds.dMax)return bounds;
 const span=Math.max(6,Math.ceil(Math.abs(t)*1.2));
 return{tMin:Math.min(bounds.tMin,-span),tMax:Math.max(bounds.tMax,span),dMin:Math.min(bounds.dMin,Math.floor(d-Math.max(1,Math.abs(d)*.2))),dMax:Math.max(bounds.dMax,Math.ceil(d+Math.max(1,Math.abs(d)*.2)))};
}

export function createTraceDetPlane({canvas,values,status,follow,reset,onChange}){
 const ctx=canvas.getContext('2d');let bounds=defaultTraceBounds(),current={t:0,d:0},pointer=null,pending=null,frame=0,applying=false,previewDirty=false;
 const number=v=>Math.abs(v)<1e-10?'0':Math.abs(v)>=10000?v.toExponential(1):Number(v.toFixed(3)).toString();
 function clearPending(){if(frame)cancelAnimationFrame(frame);frame=0;pending=null;}
 const tickStep=span=>{const raw=span/6,power=10**Math.floor(Math.log10(raw)),ratio=raw/power;return(ratio>5?10:ratio>2?5:ratio>1?2:1)*power;};
 function draw(){
  const palette=plotPalette(),theme=palette.trace;
  const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(window.devicePixelRatio||1,2);
  if(w<=56||h<=64)return;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const plot=tracePlot(w,h,bounds),project=plot.project,[zeroX,zeroY]=project(0,0);
  ctx.save();ctx.beginPath();ctx.rect(plot.left,plot.top,plot.width,plot.height);ctx.clip();
  ctx.fillStyle=theme.saddle;ctx.fillRect(plot.left,zeroY,plot.width,plot.bottom-zeroY);
  ctx.fillStyle=theme.stableNode;ctx.fillRect(plot.left,plot.top,zeroX-plot.left,zeroY-plot.top);
  ctx.fillStyle=theme.unstableNode;ctx.fillRect(zeroX,plot.top,plot.right-zeroX,zeroY-plot.top);
  for(const side of [-1,1]){
   const edge=side<0?bounds.tMin:bounds.tMax;ctx.fillStyle=side<0?theme.stableSpiral:theme.unstableSpiral;ctx.beginPath();
   ctx.moveTo(...project(0,bounds.dMax));ctx.lineTo(...project(edge,bounds.dMax));
   for(let i=0;i<=100;i++){const t=edge*(1-i/100);ctx.lineTo(...project(t,t*t/4));}ctx.closePath();ctx.fill();
  }
  // Outside this region no real 2×2 matrix can satisfy the editor's ±20 entry limit.
  ctx.fillStyle=theme.unavailable;
  for(let x=plot.left;x<plot.right;x+=3){
   const t=bounds.tMin+(x-plot.left)/plot.width*(bounds.tMax-bounds.tMin);
   if(Math.abs(t)>40){ctx.fillRect(x,plot.top,3,plot.height);continue;}
   const upper=project(t,t*t/4+400)[1],lower=project(t,20*Math.abs(t)-800)[1];
   if(upper>plot.top)ctx.fillRect(x,plot.top,3,upper-plot.top);
   if(lower<plot.bottom)ctx.fillRect(x,lower,3,plot.bottom-lower);
  }
  ctx.lineWidth=1;ctx.strokeStyle=theme.grid;
  const ts=tickStep(bounds.tMax-bounds.tMin),ds=tickStep(bounds.dMax-bounds.dMin);
  for(let t=Math.ceil(bounds.tMin/ts)*ts;t<=bounds.tMax;t+=ts){const [x]=project(t,0);ctx.beginPath();ctx.moveTo(x,plot.top);ctx.lineTo(x,plot.bottom);ctx.stroke();}
  for(let d=Math.ceil(bounds.dMin/ds)*ds;d<=bounds.dMax;d+=ds){const [,y]=project(0,d);ctx.beginPath();ctx.moveTo(plot.left,y);ctx.lineTo(plot.right,y);ctx.stroke();}
  ctx.strokeStyle=theme.axis;ctx.beginPath();ctx.moveTo(plot.left,zeroY);ctx.lineTo(plot.right,zeroY);ctx.moveTo(zeroX,plot.top);ctx.lineTo(zeroX,plot.bottom);ctx.stroke();
  ctx.strokeStyle=theme.curve;ctx.lineWidth=1.5;ctx.beginPath();
  for(let i=0;i<=200;i++){const t=bounds.tMin+(bounds.tMax-bounds.tMin)*i/200,p=project(t,t*t/4);i?ctx.lineTo(...p):ctx.moveTo(...p);}ctx.stroke();
  ctx.strokeStyle=theme.center;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(zeroX,plot.top);ctx.lineTo(zeroX,zeroY);ctx.stroke();ctx.setLineDash([]);
  const label=(lines,t,d,color)=>{const p=project(t,d);ctx.fillStyle=color;ctx.textAlign='center';ctx.font='12px sans-serif';lines.forEach((line,i)=>ctx.fillText(line,p[0],p[1]+i*15));};
  const tLabel=Math.min(bounds.tMax*.43,Math.sqrt(bounds.dMax)*.8);
  label(['Stable','spiral'],-tLabel,bounds.dMax*.76,theme.stableSpiralText);label(['Unstable','spiral'],tLabel,bounds.dMax*.76,theme.unstableSpiralText);
  for(const side of [-1,1]){const t=side*bounds.tMax*.72;label([side<0?'Stable':'Unstable','node'],t,Math.min(bounds.dMax*.32,t*t/10),side<0?theme.stableNodeText:theme.unstableNodeText);}
  label(['Saddle'],0,bounds.dMin*.62,theme.saddleText);
  const point=project(current.t,current.d);ctx.shadowColor=theme.point;ctx.shadowBlur=9;ctx.fillStyle=theme.point;ctx.strokeStyle=theme.pointOutline;ctx.lineWidth=2;ctx.beginPath();ctx.arc(point[0],point[1],5,0,2*Math.PI);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.restore();ctx.font='11px monospace';ctx.fillStyle=palette.tick;ctx.textAlign='center';
  for(let t=Math.ceil(bounds.tMin/ts)*ts;t<=bounds.tMax;t+=ts)ctx.fillText(number(t),project(t,0)[0],plot.bottom+16);
  ctx.textAlign='right';for(let d=Math.ceil(bounds.dMin/ds)*ds;d<=bounds.dMax;d+=ds)ctx.fillText(number(d),plot.left-7,project(0,d)[1]+4);
  ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText('Determinant Δ',plot.left,15);ctx.textAlign='center';ctx.fillText('Trace τ',(plot.left+plot.right)/2,h-4);ctx.textAlign='left';
 }
 function setSystem(A){
  if(A.length!==2)return;
  current={t:A[0][0]+A[1][1],d:A[0][0]*A[1][1]-A[0][1]*A[1][0]};
  if(!applying){clearPending();pointer=null;bounds=fitTraceBounds(bounds,current.t,current.d);previewDirty=false;status.textContent='';}
  values.textContent=`τ = ${number(current.t)}   Δ = ${number(current.d)}`;draw();
 }
 function apply(point,final){
  if(!point)return false;
  const matrix=matrixFromTraceDet(point.t,point.d);
  if(!matrix){status.textContent='That point requires matrix entries outside −20…20. Choose a colored region.';return false;}
  status.textContent='';applying=true;try{onChange(matrix,final);}finally{applying=false;}
  previewDirty=!final;return true;
 }
 function schedule(point){pending=point;if(frame)return;frame=requestAnimationFrame(()=>{frame=0;const next=pending;pending=null;apply(next,false);});}
 function flush(point){clearPending();if(!apply(point,true)&&previewDirty){const message=status.textContent;apply(current,true);status.textContent=message;}}
 const eventPoint=(e,clamp=false)=>{const rect=canvas.getBoundingClientRect();return tracePoint(e.clientX-rect.left,e.clientY-rect.top,rect.width,rect.height,bounds,{clamp,snap:!e.altKey});};
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0||pointer!==null)return;const point=eventPoint(e);if(!point)return;e.preventDefault();canvas.focus({preventScroll:true});clearPending();pointer=e.pointerId;canvas.setPointerCapture(pointer);apply(point,false);});
 canvas.addEventListener('pointermove',e=>{if(pointer!==null){if(e.pointerId===pointer)schedule(eventPoint(e,true));}else if(follow.checked&&e.pointerType!=='touch')schedule(eventPoint(e));});
 canvas.addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return;pointer=null;flush(eventPoint(e,true));});
 for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(pointer!==e.pointerId)return;pointer=null;if(pending||previewDirty)flush(pending??current);else clearPending();});
 canvas.addEventListener('pointerleave',()=>{if(pointer===null&&follow.checked&&(pending||previewDirty))flush(pending??current);});
 canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?1:.1;flush({t:current.t+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),d:current.d+(e.key==='ArrowDown'?-step:e.key==='ArrowUp'?step:0)});bounds=fitTraceBounds(bounds,current.t,current.d);draw();});
 follow.onchange=()=>{if(!follow.checked&&(pending||previewDirty))flush(pending??current);};
 reset.onclick=()=>{bounds=fitTraceBounds(defaultTraceBounds(),current.t,current.d);draw();};
 new ResizeObserver(draw).observe(canvas);
 return{setSystem,draw,cancel(){clearPending();pointer=null;previewDirty=false;}};
}
