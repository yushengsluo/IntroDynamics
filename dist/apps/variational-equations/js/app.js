import {presets} from './models.js';
import {solveVariational,sampleAt} from './solver.js';
import {drawPhase,drawGrowth,pickPoint} from './render.js';

const $=id=>document.getElementById(id);
const MAX_COMPARISONS=8;
const state={dimension:2,preset:null,params:{},base:[],comparisons:[],comparisonMeta:[],selected:0,start:0,end:20,time:0,playing:false,speed:1,range:4,yaw:-.65,pitch:.4,sliceAxis:2,sliceValue:0};
let solution=null,needsBuild=true,queued=false,lastStamp=null;
const validVector=v=>Array.isArray(v)&&v.every(Number.isFinite);
const norm=v=>Math.hypot(...v);
const subtract=(a,b)=>a.map((value,i)=>value-b[i]);
const fmt=value=>!Number.isFinite(value)?'—':value===0?'0':Math.abs(value)<.001||Math.abs(value)>=10000?value.toExponential(2):Number(value.toPrecision(4)).toString();
const vectorText=v=>'('+v.map(fmt).join(', ')+')';
const light=()=>window.AppTheme?.isLight()??false;

function schedule(rebuild=false){
 needsBuild ||= rebuild;
 if(!queued){queued=true;requestAnimationFrame(frame);}
}
function setPlaying(value){
 state.playing=value;lastStamp=null;
 $('play').textContent=value?'Ⅱ Pause':'▶ Play';
 $('play').setAttribute('aria-label',value?'Pause animation':'Play animation');
 schedule();
}
function frame(stamp){
 queued=false;
 if(needsBuild){
  needsBuild=false;
  try{
   solution=solveVariational(state.preset,state.params,state.base,state.comparisons,state.start,state.end);
   $('solver-status').textContent=(solution.warnings||[]).join(' ');
   $('load-error').textContent='';
  }catch(error){solution=null;state.playing=false;lastStamp=null;$('play').textContent='▶ Play';$('play').setAttribute('aria-label','Play animation');$('load-error').textContent=error.message;}
 }
 if(state.playing&&lastStamp!==null)state.time=Math.min(state.end,state.time+Math.max(0,Math.min(.1,(stamp-lastStamp)/1000))*state.speed);
 lastStamp=state.playing?stamp:null;
 if(state.time>=state.end&&state.playing){state.playing=false;lastStamp=null;$('play').textContent='▶ Play';$('play').setAttribute('aria-label','Play animation');}
 paint();
 if(state.playing)schedule();
}
function options(current){
 return {dimension:state.dimension,range:state.range,yaw:state.yaw,pitch:state.pitch,preset:state.preset,params:state.params,solution,frame:current,selected:state.selected,comparisonKinds:state.comparisonMeta.map(item=>item.kind),showAllVariations:$('show-all-variations').checked,showField:$('show-field').checked,showPaths:$('show-paths').checked,showPrediction:$('show-prediction').checked,showSeparation:$('show-separation').checked,light:light(),sliceAxis:state.sliceAxis,sliceValue:state.sliceValue,baseInitial:state.base,comparisonInitial:state.comparisons,tStart:state.start,tEnd:state.end};
}
function paint(){
 if(!solution)return;
 const current=sampleAt(solution,state.time),view=options(current);
 const result=drawPhase($('phase-canvas'),view)||{};
 drawGrowth($('growth-canvas'),view);
 $('timeline').value=String(state.time);$('time-label').textContent='t = '+state.time.toFixed(2);
 const base=current?.base,comparison=current?.comparisons?.[state.selected],variation=current?.variations?.[state.selected];
 const actual=validVector(base)&&validVector(comparison)?subtract(comparison,base):null;
 $('actual-distance').textContent=actual?fmt(norm(actual)):'—';
 $('variation-distance').textContent=validVector(variation)?fmt(norm(variation)):'—';
 $('approximation-error').textContent=actual&&validVector(variation)?fmt(norm(subtract(actual,variation))):'—';
 const matrix=validVector(base)?state.preset.jacobian(state.time,base,state.params):null;
 $('jacobian').style.gridTemplateColumns=`repeat(${state.dimension}, minmax(0, 1fr))`;
 $('jacobian').innerHTML=matrix?matrix.flat().map(value=>`<span>${fmt(value)}</span>`).join(''):'<span>Unavailable</span>';
 const arrowStatus=result.arrowUnavailable?'A variational vector is unavailable at this time because it reached the numerical limit. Shorten the time interval or reduce the initial displacement.':result.arrowClipped?'A variational arrow extends outside the view. Zoom out to see more; arrow lengths are never rescaled.':'';
 if($('arrow-status').textContent!==arrowStatus)$('arrow-status').textContent=arrowStatus;
}
function presetMenu(){
 const groups=new Map();
 for(const preset of presets.filter(item=>item.dimension===state.dimension)){
  if(!groups.has(preset.group))groups.set(preset.group,[]);
  groups.get(preset.group).push(preset);
 }
 $('preset').replaceChildren();
 for(const [label,items] of groups){
  const group=document.createElement('optgroup');group.label=label;
  for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;group.appendChild(option);}
  $('preset').appendChild(group);
 }
 $('preset').value=state.preset.id;
}
function numberField(id,label,value,min,max,step,onChange){
 const wrapper=document.createElement('label');wrapper.htmlFor=id;wrapper.textContent=label;
 const input=document.createElement('input');input.id=id;input.type='number';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(value);input.setAttribute('aria-label',label);input.setAttribute('aria-describedby','input-error');
 input.addEventListener('input',()=>{
  const next=Number(input.value),valid=input.value.trim()!==''&&Number.isFinite(next)&&next>=min&&next<=max;
  input.setAttribute('aria-invalid',String(!valid));
  if(!valid){$('input-error').textContent=`${label} must be between ${min} and ${max}.`;return;}
  onChange(next);showInputError();schedule(true);
 });
 wrapper.appendChild(input);return wrapper;
}
function showInputError(){
 $('input-error').textContent=document.querySelector('input[aria-invalid="true"]')?'Complete the highlighted value to update the illustration.':'';
}
function coordinateFields(container,values,prefix,onChange){
 container.replaceChildren();container.classList.toggle('three',state.dimension===3);
 const indices=['₁','₂','₃'];
 values.forEach((value,i)=>container.appendChild(numberField(`${prefix}-${i}`,`${prefix==='base'?'Base':'Comparison'} x${indices[i]}(0)`,value,-1000,1000,'any',next=>{onChange(i,next);updateInitialVector();updateComparisonMenu();})));
}
function updateInitialVector(){
 $('initial-vector').textContent=vectorText(subtract(state.comparisons[state.selected],state.base));
}
function updateLyapunov(){
 const data=state.preset.lyapunov?.(state.params);
 $('lyapunov-summary').hidden=!data;
 if(!data)return;
 const spectrum=[...data.exponents].sort((a,b)=>b-a),largest=spectrum[0];
 const sign=largest>0?'Positive':largest<0?'Negative':'Zero';
 const exponent=value=>value>0?'+'+fmt(value):fmt(value);
 $('lyapunov-summary').setAttribute('data-sign',sign.toLowerCase());
 $('lyapunov-kind').textContent=sign+' Lyapunov exponent';
 $('lyapunov-largest').textContent='λmax = '+exponent(largest);
 $('lyapunov-spectrum').textContent='Exact spectrum: ('+spectrum.map(exponent).join(', ')+')';
 $('lyapunov-note').textContent=data.note;
}
function directionColor(kind){
 return kind==='stable'?(light()?'#2479a4':'#77c9ef'):kind==='unstable'?'var(--orange)':null;
}
function updateDirectionPresentation(){
 const selectedKind=state.comparisonMeta[state.selected]?.kind;
 const all=$('show-all-variations').checked;
 for(const kind of ['stable','unstable'])$(kind+'-legend').hidden=!all||!state.comparisonMeta.some(item=>item.kind===kind);
 $('comparison-legend').hidden=all&&!!selectedKind;
 $('comparison-legend').style.color=directionColor(selectedKind)||'var(--violet)';
 $('comparison-dot').style.color=directionColor(selectedKind)||'var(--violet)';
 $('initial-vector-panel').style.color=directionColor(selectedKind)||'var(--orange)';
 $('variation-legend').textContent=all?'Arrows match trajectories':'Selected variational arrow η(t)';
 $('variation-legend').style.color=all?'var(--muted)':directionColor(selectedKind)||'var(--orange)';
 $('actual-legend').style.color=directionColor(selectedKind)||'var(--violet)';
 $('actual-distance').style.color=directionColor(selectedKind)||'var(--violet)';
 $('growth-variation-legend').style.color=directionColor(selectedKind)||'var(--orange)';
 $('variation-distance').style.color=directionColor(selectedKind)||'var(--orange)';
 const factory=state.preset.directionalComparisons;
 $('direction-note').hidden=!factory;
 if(factory){
  const directions=factory(state.params,state.base);
  const count=state.comparisonMeta.filter(item=>item.seeded).length;
  $('direction-note').textContent=!directions?'This base point does not support the preset’s stable/unstable construction. These points are now custom comparisons. Reset example to restore the directional pair.':count<2?'Some directional comparisons have been edited or removed. Remaining labeled directions retain their construction. Reset example to restore both directional comparisons.':directions.note;
  $('system-description').textContent=directions&&count===2?state.preset.description:'Explore the current comparison trajectories. Reset example to restore the preset’s base and its stable and unstable initial displacements.';
 }
}
function refreshDirections(){
 if(!state.preset.directionalComparisons)return;
 const directions=state.preset.directionalComparisons(state.params,state.base);
 state.comparisonMeta.forEach((meta,i)=>{
  if(!meta.seeded)return;
  const seed=directions?.comparisons.find(item=>item.kind===meta.kind);
  if(seed){state.comparisons[i]=[...seed.point];state.comparisonMeta[i]={kind:seed.kind,label:seed.label,seeded:true};}
  else state.comparisonMeta[i]={kind:null,label:'Custom comparison',seeded:false};
 });
 renderComparison();
}
function updateComparisonMenu(){
 $('comparison-select').replaceChildren();
 state.comparisons.forEach((point,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1} · ${state.comparisonMeta[i]?.label?state.comparisonMeta[i].label+' · ':''}${vectorText(point)}`;$('comparison-select').appendChild(option);});
 $('comparison-select').value=String(state.selected);
 $('comparison-count').textContent=`${state.comparisons.length} / ${MAX_COMPARISONS}`;
 $('comparison-legend').textContent=state.comparisonMeta[state.selected]?.label||`Comparison ${state.selected+1} · y(t)`;
 $('remove-comparison').disabled=state.comparisons.length<=1;
 $('add-comparison').disabled=state.comparisons.length>=MAX_COMPARISONS;
 updateDirectionPresentation();
}
function renderComparison(){
 coordinateFields($('comparison-fields'),state.comparisons[state.selected],'comparison',(i,next)=>{state.comparisons[state.selected][i]=next;state.comparisonMeta[state.selected]={kind:null,label:'Custom comparison',seeded:false};});
 updateInitialVector();updateComparisonMenu();showInputError();
}
function renderControls(){
 presetMenu();
 $('dim-2').classList.toggle('selected',state.dimension===2);$('dim-3').classList.toggle('selected',state.dimension===3);
 $('dim-2').setAttribute('aria-pressed',String(state.dimension===2));$('dim-3').setAttribute('aria-pressed',String(state.dimension===3));
 $('equations').replaceChildren();
 for(const equation of state.preset.equations){const line=document.createElement('div');line.textContent=equation;$('equations').appendChild(line);}
 $('parameters').replaceChildren();
 for(const param of state.preset.parameters){const wrapper=numberField('parameter-'+param.key,param.label,state.params[param.key],param.min,param.max,param.step??'any',next=>{state.params[param.key]=next;refreshDirections();updateLyapunov();});wrapper.className='parameter';$('parameters').appendChild(wrapper);}
 coordinateFields($('base-fields'),state.base,'base',(i,next)=>{state.base[i]=next;refreshDirections();});renderComparison();
 $('system-title').textContent=state.preset.name;$('system-description').textContent=state.preset.description;$('system-kind').textContent=`${state.dimension}D · ${state.preset.lyapunov?'Linear system':state.preset.directionalComparisons?'Nonlinear system':state.preset.group}`;
 updateLyapunov();
 $('slice-controls').hidden=state.dimension!==3;$('slice-axis').value=String(state.sliceAxis);$('slice-value').value=String(state.sliceValue);
 $('phase-hint').textContent=state.dimension===3?'Click to add on the selected plane · drag to rotate · scroll to zoom. Variational arrows start at the moving base point.':'Click to add a comparison · scroll to zoom. Variational arrows start at the moving base point.';
 $('phase-canvas').setAttribute('aria-label',state.dimension===3?'3D phase portrait. Click to add a comparison on the selected plane. Drag or use arrow keys to rotate; plus and minus zoom.':'2D phase portrait. Click to add a comparison trajectory; plus and minus zoom.');
 updateTimeControls();
}
function updateTimeControls(){
 $('time-start').value=String(state.start);$('time-end').value=String(state.end);
 $('timeline').min=String(state.start);$('timeline').max=String(state.end);$('timeline').value=String(state.time);
 $('initial-time').disabled=state.start>0||state.end<0;
}
function applyPreset(id){
 const preset=presets.find(item=>item.id===id);if(!preset)return;
 state.preset=preset;state.dimension=preset.dimension;state.params=Object.fromEntries(preset.parameters.map(param=>[param.key,param.value]));
 state.base=[...preset.base];
 const directions=preset.directionalComparisons?.(state.params,state.base);
 state.comparisons=directions?directions.comparisons.map(item=>[...item.point]):[[...preset.comparison]];
 state.comparisonMeta=directions?directions.comparisons.map(item=>({kind:item.kind,label:item.label,seeded:true})):[{kind:null,label:'',seeded:false}];state.selected=0;
 state.speed=preset.speed??1;$('speed').value=String(state.speed);
 state.start=0;state.end=preset.endTime;state.time=0;state.range=preset.range;state.yaw=-.65;state.pitch=.4;state.sliceAxis=2;state.sliceValue=0;
 for(const id of ['show-field','show-paths','show-separation'])$(id).checked=true;$('show-prediction').checked=false;
 $('show-all-variations').checked=!!directions;
 for(const id of ['time-start','time-end','slice-value'])$(id).removeAttribute('aria-invalid');
 $('input-error').textContent='';$('placement-status').textContent='';$('slice-label').textContent='x₃ =';
 setPlaying(false);renderControls();schedule(true);
}
function addComparison(point){
 if(state.comparisons.length>=MAX_COMPARISONS){$('placement-status').textContent='Up to 8 comparisons are shown at once. Remove one before adding another.';return;}
 if(!validVector(point)||point.some(value=>Math.abs(value)>1000)){$('placement-status').textContent='Choose a point with coordinates between −1000 and 1000.';return;}
 state.comparisons.push(point.map(value=>Number(value.toPrecision(8))));state.comparisonMeta.push({kind:null,label:'',seeded:false});state.selected=state.comparisons.length-1;renderComparison();
 $('placement-status').textContent=`Added comparison ${state.selected+1} at ${vectorText(state.comparisons[state.selected])}.`;schedule(true);
}
function changeTimeRange(){
 const start=Number($('time-start').value),end=Number($('time-end').value);
 const valid=$('time-start').value.trim()!==''&&$('time-end').value.trim()!==''&&Number.isFinite(start)&&Number.isFinite(end)&&start>=-50&&end<=100&&start<end;
 for(const id of ['time-start','time-end'])$(id).setAttribute('aria-invalid',String(!valid));
 if(!valid){$('input-error').textContent='Choose a start before the end, both within −50…100.';return;}
 state.start=start;state.end=end;state.time=Math.min(end,Math.max(start,state.time));lastStamp=null;
 $('timeline').min=String(start);$('timeline').max=String(end);$('initial-time').disabled=start>0||end<0;showInputError();schedule(true);
}
function zoom(factor){state.range=Math.max(.05,Math.min(100000,state.range*factor));schedule();}
$('preset').addEventListener('change',()=>applyPreset($('preset').value));
$('dim-2').addEventListener('click',()=>{if(state.dimension!==2)applyPreset('pendulum');});
$('dim-3').addEventListener('click',()=>{if(state.dimension!==3)applyPreset('lorenz');});
$('reset').addEventListener('click',()=>applyPreset(state.preset.id));
$('comparison-select').addEventListener('change',()=>{state.selected=Number($('comparison-select').value);renderComparison();schedule();});
$('add-comparison').addEventListener('click',()=>{const point=[...state.base];point[0]+=.05;addComparison(point);});
$('remove-comparison').addEventListener('click',()=>{if(state.comparisons.length<=1)return;state.comparisons.splice(state.selected,1);state.comparisonMeta.splice(state.selected,1);state.selected=Math.min(state.selected,state.comparisons.length-1);renderComparison();$('placement-status').textContent='Selected comparison removed.';schedule(true);});
$('time-start').addEventListener('input',changeTimeRange);$('time-end').addEventListener('input',changeTimeRange);
$('play').addEventListener('click',()=>{if(state.time>=state.end)state.time=state.start;setPlaying(!state.playing);});
$('restart').addEventListener('click',()=>{state.time=state.start;setPlaying(false);});
$('initial-time').addEventListener('click',()=>{state.time=0;setPlaying(false);});
$('timeline').addEventListener('input',()=>{state.time=Math.min(state.end,Math.max(state.start,Number($('timeline').value)));lastStamp=null;schedule();});
$('speed').addEventListener('change',()=>{state.speed=Number($('speed').value);});
for(const id of ['show-field','show-paths','show-prediction','show-separation'])$(id).addEventListener('change',()=>schedule());
$('show-all-variations').addEventListener('change',()=>{updateDirectionPresentation();schedule();});
$('zoom-in').addEventListener('click',()=>zoom(1/1.25));$('zoom-out').addEventListener('click',()=>zoom(1.25));
$('reset-view').addEventListener('click',()=>{state.range=state.preset.range;state.yaw=-.65;state.pitch=.4;schedule();});
$('slice-axis').addEventListener('change',()=>{state.sliceAxis=Number($('slice-axis').value);$('slice-label').textContent=['x₁ =','x₂ =','x₃ ='][state.sliceAxis];schedule();});
$('slice-value').addEventListener('input',()=>{const value=Number($('slice-value').value),valid=$('slice-value').value.trim()!==''&&Number.isFinite(value)&&Math.abs(value)<=1000;$('slice-value').setAttribute('aria-invalid',String(!valid));if(valid){state.sliceValue=value;showInputError();schedule();}else $('input-error').textContent='Placement coordinate must be between −1000 and 1000.';});
let pointer=null;
const phase=$('phase-canvas');
phase.addEventListener('pointerdown',event=>{if(event.button!==0)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,dragged:false};phase.setPointerCapture(event.pointerId);});
phase.addEventListener('pointermove',event=>{
 if(!pointer||pointer.id!==event.pointerId)return;
 if(Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>5)pointer.dragged=true;
 if(pointer.dragged&&state.dimension===3){state.yaw+=(event.clientX-pointer.lastX)*.008;state.pitch=Math.max(-1.45,Math.min(1.45,state.pitch+(event.clientY-pointer.lastY)*.008));schedule();}
 pointer.lastX=event.clientX;pointer.lastY=event.clientY;
});
phase.addEventListener('pointerup',event=>{
 if(!pointer||pointer.id!==event.pointerId)return;
 const click=!pointer.dragged&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)<=5;pointer=null;
 if(phase.hasPointerCapture(event.pointerId))phase.releasePointerCapture(event.pointerId);
 if(!click)return;
 if($('slice-value').getAttribute('aria-invalid')==='true'&&state.dimension===3){$('placement-status').textContent='Complete the placement-plane coordinate before adding a point.';return;}
 const rect=phase.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
 if(x<0||y<0||x>rect.width||y>rect.height)return;
 const point=pickPoint(x,y,rect.width,rect.height,options(null));
 if(point)addComparison(point);else $('placement-status').textContent='This placement plane is edge-on. Rotate the view or choose another plane.';
});
phase.addEventListener('pointercancel',()=>{pointer=null;});phase.addEventListener('lostpointercapture',()=>{pointer=null;});
phase.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(Math.max(-.3,Math.min(.3,event.deltaY*.001))));},{passive:false});
phase.addEventListener('keydown',event=>{
 if(['+','=','-','_'].includes(event.key)){event.preventDefault();zoom(['+','='].includes(event.key)?1/1.25:1.25);}
 else if(state.dimension===3&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();if(event.key==='ArrowLeft')state.yaw-=.1;if(event.key==='ArrowRight')state.yaw+=.1;if(event.key==='ArrowUp')state.pitch=Math.max(-1.45,state.pitch-.1);if(event.key==='ArrowDown')state.pitch=Math.min(1.45,state.pitch+.1);schedule();}
});
$('guide-button').addEventListener('click',()=>$('guide').showModal());
$('guide').addEventListener('click',event=>{if(event.target!==$('guide'))return;const rect=$('guide').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('guide').close();});
window.addEventListener('themechange',()=>{updateDirectionPresentation();schedule();});window.addEventListener('resize',()=>schedule());
document.addEventListener('visibilitychange',()=>{lastStamp=null;});
new ResizeObserver(()=>schedule()).observe(document.querySelector('main'));
applyPreset('pendulum');
