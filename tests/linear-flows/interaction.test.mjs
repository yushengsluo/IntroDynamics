// Run the real event handlers with a minimal DOM and canvas, without a browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {scene3D} from '../../dist/apps/linear-flows/js/scene.js';
import {tracePlot,defaultTraceBounds} from '../../dist/apps/linear-flows/js/trace-determinant.js';
import {expm,matVec} from '../../dist/apps/linear-flows/js/math.js';
const elements=new Map(),registered=new Map();
const contexts=new Map();
function canvasContext(id){
 if(contexts.has(id))return contexts.get(id);
 let path=[];
 const context=new Proxy({strokes:[],arcs:[],clearRect(){this.strokes=[];this.arcs=[];},beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},arc(x,y,radius){this.arcs.push({x,y,radius,color:this.fillStyle,stroke:this.strokeStyle});},stroke(){this.strokes.push({color:this.strokeStyle,path:path.map(p=>[...p])});}}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 contexts.set(id,context);return context;
}
let canvasWidth=Number(process.env.TEST_CANVAS_WIDTH??900),canvasHeight=Number(process.env.TEST_CANVAS_HEIGHT??400);
const resizeCallbacks=[];
function element(id){
 if(elements.has(id))return elements.get(id);
 let value='';
 let markup='',replacements=0;
 const e={id,get value(){return value;},set value(v){value=String(v);},textContent:'',get innerHTML(){return markup;},set innerHTML(v){markup=v;replacements++;for(const tag of v.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const child=element(tag[1]),initial=tag[0].match(/\bvalue="([^"]*)"/);if(initial)child.value=initial[1];}},get replacements(){return replacements;},style:{},dataset:{},listeners:{},classList:{toggle(){}},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},setPointerCapture(){},focus(){},addEventListener(k,fn){this.listeners[k]=fn;},getBoundingClientRect(){return {width:canvasWidth,height:canvasHeight,left:0,top:0};},getContext(){return canvasContext(id);}};
 elements.set(id,e);return e;
}
const html=fs.readFileSync(new URL('../../dist/apps/linear-flows/index.html',import.meta.url),'utf8');
for(const m of html.matchAll(/id="([^"]+)"[^>]*?(?:>|$)/g)){const e=element(m[1]),v=m[0].match(/\bvalue="([^"]*)"/);if(v)e.value=v[1];}
globalThis.document={getElementById:id=>{assert.ok(elements.has(id),`Missing element: ${id}`);return element(id);},querySelector:()=>element('legend-z'),modelContext:{registerTool(tool){registered.set(tool.name,tool);}}};
globalThis.window={devicePixelRatio:1,addEventListener(){}};
globalThis.ResizeObserver=class{constructor(callback){resizeCallbacks.push(callback);}observe(){}};
const frames=new Map();let frameId=0;
globalThis.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
const flushFrames=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(0));};
if(process.env.TEST_APP_BUNDLE==='1')vm.runInThisContext(fs.readFileSync(new URL('../../dist/apps/linear-flows/js/app.bundle.js',import.meta.url),'utf8'),{filename:'app.bundle.js'});
else await import('../../dist/apps/linear-flows/js/app.js');
canvasWidth=900;canvasHeight=400;resizeCallbacks.forEach(callback=>callback());
const read=()=>registered.get('get_linear_system').execute(),canvas=element('phase-canvas');
const event=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y});
const click=(x,y)=>{canvas.listeners.pointerdown(event(x,y));canvas.listeners.pointerup(event(x,y));};
assert.deepEqual(read().timeInterval,{start:-20,end:20});assert.equal(read().initialConditions.length,11);
assert.deepEqual(read().initialConditions[0],[0,0]);
for(let i=0;i<8;i++){
 const angle=i*Math.PI/4,expected=[3*Math.cos(angle),3*Math.sin(angle)];
 assert.ok(read().initialConditions.some(x=>Math.hypot(...x.map((v,j)=>v-expected[j]))<1e-10),'2D defaults cover the axes and every quadrant before exploration');
}
const field2D=()=>{
 const scale=400/(2*read().phaseRange.max);
 return new Map(contexts.get('phase-canvas').strokes.filter(s=>s.color==='#4c71847a').map(s=>{
  const x=((s.path[0][0]+s.path[1][0])/2-450)/scale,y=(200-(s.path[0][1]+s.path[1][1])/2)/scale;
  return [[x,y].map(v=>Math.round(v*1e6)).join(','),{x,y,path:s.path}];
 }));
};
const originalField2D=field2D();
function assertFieldZoom(factor){
 const actual=field2D();let compared=0;
 for(const [key,arrow] of originalField2D){
  if(Math.abs(arrow.x)>2||Math.abs(arrow.y)>2)continue;
  const current=actual.get(key);assert.ok(current,'2D arrows stay at the same world coordinates');
  arrow.path.forEach((point,i)=>point.forEach((value,axis)=>{
   const center=axis===0?450:200,expected=center+(value-center)*factor;
   assert.ok(Math.abs(current.path[i][axis]-expected)<1e-7,'2D arrow positions, shafts, and heads zoom together');
  }));compared++;
 }
 assert.ok(compared>=20,'Compare arrows across all four quadrants');
}
element('zoom-in').onclick();assertFieldZoom(1.25);
element('zoom-out').onclick();assertFieldZoom(1);
canvas.listeners.wheel({deltaY:Math.log(1.25)/.001,preventDefault(){}});assertFieldZoom(.8);
canvas.listeners.keydown({key:'+',preventDefault(){}});assertFieldZoom(1);
element('reset-view').onclick();assertFieldZoom(1);
click(510,280);assert.deepEqual(read().initialConditions.at(-1),[1.5,-2]);assert.equal(read().time,0);
const matrixReplacements=element('matrix').replacements;
element('matrix').listeners.change({target:{value:'-0.2',dataset:{row:'0',col:'0'}}});
assert.equal(element('matrix').replacements,matrixReplacements,'Editing a cell must preserve the matrix input nodes and focus');
assert.equal(read().matrix[0][0],-.2);
assert.deepEqual(read().initialConditions.at(-1),[1.5,-2]);
assert.ok(read().initialPointLabels.at(-1).startsWith('Placed point'));
element('dim-3').onclick();assert.equal(read().dimension,3);assert.equal(element('placement-bar').hidden,false);
element('slice-value').onchange({target:{value:'−2.75'}});
const gridColors=['#26394e55','#2d466166'];
const zoomLayers={'#26394e55':'cubic grid','#2d466166':'coordinate plane grid','#568c80':'x axis','#756caa':'y axis','#94765d':'z axis','#61dfbd50':'placement plane','#47677e6b':'vector field','#b39af1':'trajectory'};
const geometry=()=>Object.fromEntries(Object.keys(zoomLayers).map(color=>[color,contexts.get('phase-canvas').strokes.filter(s=>s.color===color&&s.path.length>=2).flatMap(s=>gridColors.includes(color)?Array.from({length:s.path.length/2},(_,i)=>s.path.slice(2*i,2*i+2)):[s.path.slice(0,2)])]));
const originalGeometry=geometry();
const gridCount=()=>gridColors.reduce((sum,color)=>sum+geometry()[color].length,0);
const initialGridCount=gridCount();assert.ok(initialGridCount>12&&initialGridCount<=2000);
const lineForm=([a,b])=>{
 const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
 return[nx,ny,(a[0]-450)*nx+(a[1]-200)*ny];
};
function assertZoom(factor){
 const actual=geometry();
 for(const [color,label] of Object.entries(zoomLayers)){
  assert.ok(originalGeometry[color].length>0,`${label} is drawn`);
  if(gridColors.includes(color)){
   const step=scene3D(5,900,400,.65,.5).gridStep,forms=actual[color].map(lineForm);
   // Check shared lattice lines through nearby grid coordinates; their ends extend with the viewport.
   for(let axis=0;axis<3;axis++){
    const others=[0,1,2].filter(i=>i!==axis),a=[0,0,0],b=[0,0,0];a[axis]=-10;b[axis]=10;
    a[others[0]]=b[others[0]]=step;
    a[others[1]]=b[others[1]]=color===gridColors[0]?step:0;
    const project=p=>[450+40*(p[0]*Math.cos(.65)-p[1]*Math.sin(.65)),200-40*(Math.sin(.5)*(p[0]*Math.sin(.65)+p[1]*Math.cos(.65))+p[2]*Math.cos(.5))];
    const expected=lineForm([project(a),project(b)]);expected[2]*=factor;
    assert.ok(forms.some(form=>form.every((value,i)=>Math.abs(value-expected[i])<1e-7)),`${label} stays aligned to world coordinates while zooming`);
   }
   continue;
  }
  if(['#568c80','#756caa','#94765d'].includes(color)){
   const original=lineForm(originalGeometry[color][0]),current=lineForm(actual[color][0]);
   assert.ok(current.every((value,i)=>Math.abs(value-original[i])<1e-7),'Extended axes retain their direction and origin');continue;
  }
  if(color==='#47677e6b'){
   // Check the six axial samples, which remain within the visible depth slab.
   const step=scene3D(5,900,400,.65,.5).fieldStep,anchors=[];
   for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
    const p=[0,0,0];p[axis]=step*sign;
    anchors.push([450+40*(p[0]*Math.cos(.65)-p[1]*Math.sin(.65)),200-40*(Math.sin(.5)*(p[0]*Math.sin(.65)+p[1]*Math.cos(.65))+p[2]*Math.cos(.5))]);
   }
   const shared=originalGeometry[color].filter(line=>anchors.some(p=>Math.hypot(p[0]-line[0][0],p[1]-line[0][1])<1e-7));
   assert.equal(shared.length,6);
   for(const line of shared){
    const expected=line.map(point=>point.map((value,axis)=>(axis===0?450:200)+(value-(axis===0?450:200))*factor));
    assert.ok(actual[color].some(candidate=>candidate.every((point,j)=>point.every((value,axis)=>Math.abs(value-expected[j][axis])<1e-7))),`${label} preserves shared world samples`);
   }
   continue;
  }
  assert.equal(actual[color].length,originalGeometry[color].length,`${label} keeps its geometry`);
  originalGeometry[color].forEach((line,i)=>line.forEach((point,j)=>point.forEach((value,axis)=>{
   const center=axis===0?450:200,expected=center+(value-center)*factor;
   assert.ok(Math.abs(actual[color][i][j][axis]-expected)<1e-7*Math.max(1,Math.abs(expected)),`${label} scales with the trajectories`);
  })));
 }
}
element('zoom-in').onclick();assertZoom(1.25);
const point=[2,-1,-2.75],yaw=.65,pitch=.5,u=Math.cos(yaw)*point[0]-Math.sin(yaw)*point[1],v=Math.sin(pitch)*(Math.sin(yaw)*point[0]+Math.cos(yaw)*point[1])+Math.cos(pitch)*point[2];
click(450+u*50,200-v*50);
assert.ok(Math.hypot(...read().initialConditions.at(-1).map((x,i)=>x-point[i]))<1e-10);
element('zoom-out').onclick();assertZoom(1);
canvas.listeners.wheel({deltaY:Math.log(1.25)/.001,preventDefault(){}});assertZoom(.8);
canvas.listeners.keydown({key:'+',preventDefault(){}});assertZoom(1);
element('reset-view').onclick();assertZoom(1);
const beforeDrag=read().initialConditions.length;
canvas.listeners.pointerdown(event(450,200));canvas.listeners.pointermove(event(510,200));canvas.listeners.pointerup(event(510,200));
assert.equal(read().initialConditions.length,beforeDrag);
for(let i=0;i<4;i++)canvas.listeners.keydown({key:'ArrowDown',preventDefault(){}});
click(450,200);assert.equal(read().initialConditions.length,beforeDrag);
assert.match(element('placement-status').textContent,/edge-on/);
element('preset').onchange({target:{value:'saddle'}});
assert.equal(read().initialConditions.length,27);
assert.equal(read().initialPointLabels.filter(s=>s.startsWith('Stable direction')).length,4);
assert.equal(read().initialPointLabels.filter(s=>s.startsWith('Unstable direction')).length,2);
element('add-trajectory').onclick();assert.equal(read().initialConditions.length,28);
element('representative-points').onclick();assert.equal(read().initialConditions.length,27);
element('reset-view').onclick();
const initialGrid=gridColors.flatMap(color=>geometry()[color]);
canvas.listeners.wheel({deltaY:Math.log(32)/.001,preventDefault(){}});
assert.ok(read().phaseRange.max>40,'3D zoom extends beyond the old range limit');
const distantGeometry=geometry();
assert.ok(gridCount()>12&&gridCount()<=2000,'Periodic grid remains visible and bounded when zoomed out');
assert.ok(distantGeometry['#47677e6b'].length>0&&distantGeometry['#47677e6b'].length<=4096,'The extended field stays visible and bounded');
const axisExtent=lines=>Math.max(...lines.flat().map(p=>Math.hypot(p[0]-450,p[1]-200)));
assert.ok(axisExtent(gridColors.flatMap(color=>distantGeometry[color]))>axisExtent(initialGrid)/10,'The grid continues filling the visible view');
canvas.listeners.wheel({deltaY:Math.log(1e12)/.001,preventDefault(){}});
assert.ok(read().phaseRange.max>1e12);
for(const lines of Object.values(geometry()))assert.ok(lines.flat(2).every(Number.isFinite),'Distant drawing coordinates stay finite');
canvas.listeners.wheel({deltaY:1e6,preventDefault(){}});
assert.ok(Number.isFinite(read().phaseRange.max),'Extreme scroll input stays within numerical limits');
for(const lines of Object.values(geometry()))assert.ok(lines.flat(2).every(Number.isFinite),'Rendering stays finite at the numerical limit');
element('reset-view').onclick();assert.equal(read().phaseRange.max,5);
assert.equal(gridCount(),initialGridCount);
// A custom system must also reset its range when switching back to the 2D renderer.
element('matrix').listeners.change({target:{value:'0.5',dataset:{row:'0',col:'0'}}});
canvas.listeners.wheel({deltaY:Math.log(1e12)/.001,preventDefault(){}});
element('dim-2').onclick();assert.equal(read().phaseRange.max,5);assert.equal(read().dimension,2);
assert.equal(element('trace-panel').hidden,false);
const traceCanvas=element('trace-canvas'),tdPlot=tracePlot(900,400,defaultTraceBounds());
const tdEvent=(t,d,extras={})=>{const p=tdPlot.project(t,d);return{button:0,pointerId:8,pointerType:'mouse',clientX:p[0],clientY:p[1],preventDefault(){},...extras};};
const manualPoint=[1.5,-2];click(510,280);
const explorationPoints=structuredClone(read().initialConditions),selectedTrajectory=element('chart-trajectory').value;
const trackedIndices=read().initialPointLabels.flatMap((label,i)=>label.startsWith('Tracked ')?[i]:[]);
assert.equal(trackedIndices.length,2,'Reserve both tracked directions before entering the saddle region');
const fixedOnly=values=>values.filter((_,i)=>!trackedIndices.includes(i));
element('timeline').oninput({target:{value:'.2'}});
const initialMarkers=()=>contexts.get('phase-canvas').arcs.filter(p=>p.radius===4||p.radius===5.5).map(({x,y,radius,stroke})=>({x,y,radius,stroke}));
const explorationMarkers=initialMarkers();
const assertStablePoints=()=>{
 assert.equal(read().initialConditions.length,explorationPoints.length,'Parameter exploration never adds or removes initial points');
 assert.deepEqual(fixedOnly(read().initialConditions),fixedOnly(explorationPoints),'Parameter exploration preserves fixed and manual points');
 assert.equal(element('chart-trajectory').value,selectedTrajectory,'Parameter exploration preserves the selected trajectory');
 assert.deepEqual(fixedOnly(initialMarkers()),fixedOnly(explorationMarkers),'Fixed markers retain their positions, colors, and selection');
 assert.deepEqual(initialMarkers().map(p=>[p.radius,p.stroke]),explorationMarkers.map(p=>[p.radius,p.stroke]),'Tracked points also retain their colors and selection');
 for(const i of trackedIndices)read().initialConditions[i].forEach((v,j)=>assert.equal(Number(element('seed-'+i+'-'+j).value),v,'Tracked coordinates stay synchronized with the inputs'));
};
traceCanvas.listeners.pointerdown(tdEvent(-3,2));
assert.equal(read().analysis.title,'Stable node');assert.equal(read().analysis.trace,-3);assert.equal(read().analysis.det,2);
assertStablePoints();
const moved=matVec(expm(read().matrix,.2),explorationPoints[1]),expectedMarker=[450+40*moved[0],200-40*moved[1]];
assert.ok(contexts.get('phase-canvas').arcs.some(p=>p.radius===4.4&&p.color==='#b39af1'&&Math.hypot(p.x-expectedMarker[0],p.y-expectedMarker[1])<1e-7),'Animated samples use the new matrix, not the old cached eigenmodes');
const fixedLabels=read().initialPointLabels,seedReplacements=element('initials').replacements,optionReplacements=element('chart-trajectory').replacements;
assert.ok(!fixedOnly(fixedLabels).some(label=>/direction|λ =|mixed modes|Spiral/.test(label)),'Former untracked invariant modes are labeled as fixed samples');
traceCanvas.listeners.pointermove(tdEvent(3,2));flushFrames();
assert.equal(read().analysis.title,'Unstable node','Dragging changes the portrait before pointer release');
for(const [t,d] of [[3,3],[2,1],[-2,1],[-3,3],[0,4],[0,-1],[2,0],[0,0]]){
 traceCanvas.listeners.pointermove(tdEvent(t,d));flushFrames();assertStablePoints();
 assert.deepEqual(fixedOnly(read().initialPointLabels),fixedOnly(fixedLabels),'Crossing regions does not relabel or replace fixed sample points');
}
traceCanvas.listeners.pointerup(tdEvent(0,4));
assert.equal(read().analysis.title,'Center / rotation');assert.deepEqual(read().initialConditions.at(-1),manualPoint,'Placed initial points survive parameter changes');
assertStablePoints();
const portraitPaths=contexts.get('phase-canvas').strokes.filter(s=>s.path.length>100);
const expectedStart=matVec(expm(read().matrix,-20),explorationPoints[1]);
assert.ok(Math.hypot(portraitPaths[1].path[0][0]-(450+40*expectedStart[0]),portraitPaths[1].path[0][1]-(200-40*expectedStart[1]))<1e-7,'Full paths also discard spectral components from the previous matrix');
traceCanvas.listeners.pointermove(tdEvent(0,-1));flushFrames();assert.equal(read().analysis.det,4,'Hover is opt-in');
element('trace-follow').checked=true;traceCanvas.listeners.pointermove(tdEvent(0,-1));flushFrames();
assert.equal(read().analysis.title,'Saddle');traceCanvas.listeners.pointerleave();
assertStablePoints();
for(const i of trackedIndices){
 assert.match(read().initialPointLabels[i],/stable direction → origin/);
 const x=read().initialConditions[i],Ax=matVec(read().matrix,x);
 assert.ok(Math.hypot(...Ax.map((v,j)=>v+x[j]))<1e-10,'Saddle samples lie on the negative eigenvalue direction');
}
element('timeline').oninput({target:{value:'20'}});
for(const i of trackedIndices){
 const x=read().initialConditions[i],expected=x.map(v=>v*Math.exp(-20));
 assert.ok(contexts.get('phase-canvas').arcs.some(p=>p.radius===4.4&&Math.hypot(p.x-(450+40*expected[0]),p.y-(200-40*expected[1]))<1e-9),'Stable markers converge to the origin without growing-mode leakage');
}
element('trace-follow').checked=false;
traceCanvas.listeners.keydown({key:'ArrowLeft',preventDefault(){}});assert.ok(Math.abs(read().analysis.trace+.1)<1e-10);
assertStablePoints();
assert.equal(element('initials').replacements,seedReplacements,'Exploration does not repeatedly recreate initial-condition inputs');
assert.equal(element('chart-trajectory').replacements,optionReplacements,'Exploration does not repeatedly recreate the trajectory selector');
element('initials').onclick({target:{closest:()=>({dataset:{remove:'2'}})}});
const afterRemoval=structuredClone(read().initialConditions);
traceCanvas.listeners.pointerdown(tdEvent(3,2));traceCanvas.listeners.pointerup(tdEvent(3,3));
assert.equal(read().initialConditions.length,afterRemoval.length,'Deleted sample points are not re-added while exploring');
const remainingFixed=read().initialPointLabels.flatMap((label,i)=>label.startsWith('Tracked ')?[]:[i]);
for(const i of remainingFixed)assert.deepEqual(read().initialConditions[i],afterRemoval[i]);
const trackedToRemove=read().initialPointLabels.findIndex(label=>label.startsWith('Tracked '));
element('initials').onclick({target:{closest:()=>({dataset:{remove:String(trackedToRemove)}})}});
traceCanvas.listeners.pointerdown(tdEvent(0,-1));traceCanvas.listeners.pointerup(tdEvent(0,-1));
assert.equal(read().initialPointLabels.filter(label=>label.startsWith('Tracked ')).length,1,'Deleted tracked directions are not re-added');
const trackedToEdit=read().initialPointLabels.findIndex(label=>label.startsWith('Tracked '));
element('initials').listeners.change({target:{value:'-2.25',dataset:{seed:String(trackedToEdit),axis:'0'},matches:()=>true,removeAttribute(){},closest:()=>({querySelector:()=>element('seed-label-'+trackedToEdit)})}});
const editedTracked=[...read().initialConditions[trackedToEdit]];
traceCanvas.listeners.pointerdown(tdEvent(-3,3));traceCanvas.listeners.pointerup(tdEvent(-3,3));
assert.deepEqual(read().initialConditions[trackedToEdit],editedTracked,'Editing a tracked point turns it into a fixed custom point');
assert.equal(read().initialPointLabels.filter(label=>label.startsWith('Tracked ')).length,0);
// Readback of a manual matrix must not replace it with the representative family.
registered.get('configure_linear_system').execute({matrix:[[2,0],[0,2]],initialConditions:[[1,1]]});
assert.deepEqual(read().matrix,[[2,0],[0,2]]);assert.match(element('trace-values').textContent,/τ = 4.*Δ = 4/);
element('trace-follow').checked=true;
traceCanvas.listeners.pointermove({pointerId:8,pointerType:'mouse',clientX:0,clientY:0});flushFrames();traceCanvas.listeners.pointerleave();
assert.deepEqual(read().matrix,[[2,0],[0,2]],'Crossing the canvas margin does not replace a manual matrix');
traceCanvas.listeners.pointermove(tdEvent(-3,2));
registered.get('configure_linear_system').execute({matrix:[[2,0],[0,2]],initialConditions:[[1,1]]});flushFrames();
assert.deepEqual(read().matrix,[[2,0],[0,2]],'Pending hover updates do not overwrite a later matrix edit');
traceCanvas.listeners.pointermove(tdEvent(-3,2));traceCanvas.listeners.pointerdown(tdEvent(3,2));flushFrames();
assert.equal(read().analysis.title,'Unstable node','A click supersedes an older queued hover update');traceCanvas.listeners.pointerup(tdEvent(3,2));
assert.deepEqual(read().initialConditions,[[1,1]],'Explicitly configured initial conditions remain unchanged during exploration');
registered.get('configure_linear_system').execute({matrix:[[20,20],[-20,20]],initialConditions:[[1,1]]});
// This expands the view; the bottom-right plot corner lies outside the feasible region.
traceCanvas.listeners.pointerdown({pointerId:8,button:0,clientX:880,clientY:355,preventDefault(){}});
traceCanvas.listeners.pointercancel({pointerId:8});
assert.deepEqual(read().matrix,[[20,20],[-20,20]],'Canceling an infeasible point preserves the manual matrix');
element('dim-3').onclick();assert.equal(element('trace-panel').hidden,true);
element('trace-follow').checked=true;traceCanvas.listeners.pointermove(tdEvent(1,2));flushFrames();assert.equal(read().dimension,3);
element('dim-2').onclick();assert.equal(element('trace-panel').hidden,false);
console.log('Passed: 2D/3D placement, periodic grid, synchronized zoom, negative slice, drag separation, edge-on handling, preserved manual points, and automatic defaults.');
