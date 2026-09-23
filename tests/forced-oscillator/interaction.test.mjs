import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createSolution} from '../../dist/apps/forced-oscillator/js/oscillator.js';

const elements=new Map(),contexts=new Map(),frames=[],resize=[];
let width=0,height=0;
function context(id){
 if(contexts.has(id))return contexts.get(id);
 const ctx=new Proxy({arcs:[],strokes:0,paths:[],path:[],globalAlpha:1,clearRect(){this.arcs=[];this.strokes=0;this.paths=[];},beginPath(){this.path=[];},moveTo(x,y){assert.ok([x,y].every(Number.isFinite));this.path.push([x,y]);},lineTo(x,y){assert.ok([x,y].every(Number.isFinite));this.path.push([x,y]);},arc(x,y,r){assert.ok([x,y,r].every(Number.isFinite));this.arcs.push({x,y,r,color:this.fillStyle});},fill(){if(this.arcs.length)this.arcs.at(-1).filled=true;},stroke(path){this.strokes++;this.paths.push({color:this.strokeStyle,width:this.lineWidth,alpha:this.globalAlpha,points:path?.points??this.path});}},
  {get:(o,key)=>o[key]??((...values)=>{for(const value of values)if(typeof value==='number')assert.ok(Number.isFinite(value),`${key}: nonfinite geometry`);})});
 contexts.set(id,ctx);return ctx;
}
const html=fs.readFileSync(new URL('../../dist/apps/forced-oscillator/index.html',import.meta.url),'utf8');
for(const [tag,id] of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){
 const value=tag.match(/\bvalue="([^"]*)"/);
 elements.set(id,{value:value?.[1]??'',textContent:'',checked:/\bchecked\b/.test(tag),hidden:false,listeners:{},attributes:{},
  addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(key,value){this.attributes[key]=value;},
  getBoundingClientRect(){return {width,height,left:120,top:80};},getContext(){return context(id);}});
}
const $=id=>elements.get(id),flush=(timestamp=0)=>{const pending=frames.splice(0);pending.forEach(fn=>fn(timestamp));};
const fire=(id,type='input',value)=>{const e=$(id);if(value!==undefined)e.value=String(value);e.listeners[type]({target:e});};
globalThis.document={getElementById:id=>$(id)??null,querySelector:()=>({}),addEventListener(){}};
const windowListeners=new Map();let lightTheme=false;
globalThis.window={devicePixelRatio:2,AppTheme:{isLight:()=>lightTheme},addEventListener(type,listener){windowListeners.set(type,listener);}};
globalThis.ResizeObserver=class{constructor(fn){resize.push(fn);}observe(){}};
globalThis.requestAnimationFrame=fn=>frames.push(fn);
// Exercise the browser's static Path2D cache as well as uncached animated trails.
globalThis.Path2D=class{
 constructor(){this.points=[];}
 moveTo(x,y){assert.ok([x,y].every(Number.isFinite));this.points.push([x,y]);}
 lineTo(x,y){assert.ok([x,y].every(Number.isFinite));this.points.push([x,y]);}
};
if(process.env.TEST_OSCILLATOR_BUNDLE==='1')vm.runInThisContext(fs.readFileSync(new URL('../../dist/apps/forced-oscillator/js/app.bundle.js',import.meta.url),'utf8'),{filename:'oscillator.bundle.js'});
else await import('../../dist/apps/forced-oscillator/js/app.js');
flush();assert.equal(contexts.size,0,'Collapsed canvases do not draw');
width=600;height=280;resize.forEach(fn=>fn());flush();
assert.equal(contexts.size,4);for(const ctx of contexts.values())assert.ok(ctx.strokes>0);
assert.equal($('current-x').textContent,'0.000');assert.equal($('regime').textContent,'Underdamped');
fire('x0','input',-3.5);fire('v0','input',-2);flush();
assert.equal($('current-x').textContent,'-3.500');assert.equal($('current-v').textContent,'-2.000');
fire('b','input','');fire('b','change');flush();assert.match($('input-error').textContent,/Damping/);
assert.equal($('current-x').textContent,'-3.500','Partial edits leave the last valid solution visible');
fire('b','input',-1);fire('b','change');assert.equal($('b').attributes['aria-invalid'],'true');
fire('b-slider','input',.75);flush();assert.equal($('b').value,'0.75');assert.equal($('input-error').textContent,'');
fire('omega','input',1.23);flush();assert.equal($('omega-slider').value,'1.23');
fire('preset','change','resonance');flush();
assert.equal($('regime').textContent,'Undamped');assert.equal($('response-amplitude').textContent,'Unbounded at resonance');assert.equal($('particular-legend').hidden,true);
fire('timeline','input',10);flush();
assert.equal($('time-label').textContent,'t = 10.00');
assert.equal($('current-x').textContent,(5*Math.sin(10)).toFixed(3));
assert.equal($('current-v').textContent,(Math.sin(10)/2+5*Math.cos(10)).toFixed(3));
// The plotted marker and the number readout must use the same exact current state.
const solution=createSolution({b:0,k:1,omega:1}),samples=solution.sample(40),xRange=1.12*Math.max(.5,...samples.map(p=>Math.abs(p.x))),vRange=1.12*Math.max(.5,...samples.map(p=>Math.abs(p.v)));
const dot=contexts.get('phase-canvas').arcs.find(a=>a.color==='#61dfbd'&&a.r===4),current=solution.at(10);
assert.ok(Math.abs(dot.x-(48+(current.x+xRange)/(2*xRange)*(600-20-48)))<1e-8);
assert.ok(Math.abs(dot.y-(280-31-(current.v+vRange)/(2*vRange)*(280-31-24)))<1e-8);
fire('play','click');flush(1000);flush(1100);
assert.equal($('play').attributes['aria-label'],'Pause animation');assert.equal($('time-label').textContent,'t = 10.10');
fire('b','input',.2);flush(1200);
assert.equal($('time-label').textContent,'t = 10.20','Changing coefficients retains animation time');
assert.equal($('play').attributes['aria-label'],'Pause animation');
fire('play','click');flush();fire('speed','change',2);fire('play','click');flush(1300);flush(1400);
assert.equal($('time-label').textContent,'t = 10.40');fire('play','click');flush();
fire('duration','input',5);flush();assert.equal($('time-label').textContent,'t = 5.00');assert.equal($('timeline').max,'5');
fire('play','click');flush(1500);assert.equal($('time-label').textContent,'t = 0.00','Play restarts at the end');
fire('restart','click');flush();assert.equal($('play').attributes['aria-label'],'Play animation');
$('show-force').checked=false;fire('show-force','change');flush();assert.equal($('force-legend').hidden,true);
$('show-particular').checked=false;fire('show-particular','change');flush();assert.equal($('particular-legend').hidden,true);
fire('preset','change','critical');flush();assert.equal($('regime').textContent,'Critically damped');
fire('preset','change','beats');flush();assert.match($('insight').textContent,/beats/);assert.match($('comparison-note').textContent,/persist/);
fire('omega','input',0);flush();assert.match($('insight').textContent,/constant/);
fire('reset','click');flush();assert.equal($('time-label').textContent,'t = 0.00');assert.equal($('b').value,'0.4');assert.equal($('x0').value,'0');assert.equal($('duration').value,'40');assert.equal($('speed').value,'1');assert.equal($('show-force').checked,true);assert.equal($('show-particular').checked,true);
fire('preset','change','resonance');fire('start-time','input',-20);fire('duration','input',20);flush();
fire('start-time','input','-0');flush();assert.equal($('start-time').value,'-0','Typing a negative decimal keeps the intermediate minus sign');
fire('start-time','input','-0.250');flush();assert.equal($('start-time').value,'-0.250','Time edits preserve the input text and caret');
fire('start-time','input',-20);flush();
assert.equal($('timeline').min,'-20');assert.equal($('timeline').max,'20');assert.equal($('time-label').textContent,'t = 0.00');
assert.equal($('current-x').textContent,'0.000','The initial condition remains anchored at t = 0');
fire('restart','click');flush();assert.equal($('time-label').textContent,'t = -20.00');assert.equal($('current-x').textContent,solution.at(-20).x.toFixed(3));
fire('play','click');flush(2000);flush(2100);assert.equal($('time-label').textContent,'t = -19.90');
fire('play','click');flush();fire('duration','input',-5);flush();assert.equal($('timeline').max,'-5');
fire('duration','input',-30);fire('duration','change');flush();
assert.match($('input-error').textContent,/Start time must be less/);assert.equal($('timeline').max,'-5','Reversed ranges leave the valid simulation intact');
fire('start-time','input',-40);flush();assert.equal($('input-error').textContent,'');assert.equal($('timeline').min,'-40');assert.equal($('timeline').max,'-30');
fire('timeline','input',-30.01);fire('play','click');flush(2200);flush(2300);
assert.equal($('time-label').textContent,'t = -30.00');assert.equal($('play').attributes['aria-label'],'Play animation','Playback stops at a negative end time');
fire('preset','change','critical');flush();assert.equal($('time-label').textContent,'t = -40.00');assert.equal($('timeline').max,'-30','Presets preserve the selected interval');
fire('reset','click');flush();assert.equal($('start-time').value,'0');assert.equal($('timeline').min,'0');
fire('start-time','input',5);fire('duration','input',12);fire('restart','click');flush();
assert.equal($('time-label').textContent,'t = 5.00');assert.equal($('current-x').textContent,createSolution({b:.4,k:1,omega:.8}).at(5).x.toFixed(3));
fire('start-time','input','');fire('start-time','change');flush();assert.match($('input-error').textContent,/Start time must be between/);assert.equal($('timeline').min,'5');
fire('start-time','input',-120);fire('duration','input',20);fire('b','input',10);fire('k','input',.1);fire('omega','input',0);fire('restart','click');flush();
assert.match($('range-note').textContent,/growth exceeds/);assert.equal($('current-x').textContent,'—');
fire('timeline','input',0);flush();assert.equal($('current-x').textContent,'0.000');
fire('timeline','input',20);flush();assert.ok(Number.isFinite(Number($('current-x').textContent)));
fire('reset','click');flush();assert.equal($('range-note').textContent,'');
console.log('Passed: oscillator controls, signed time windows, initial anchoring, extreme growth, playback bounds, and resets.');
fire('timeline','input',3);fire('model','change','duffing');flush();
assert.equal($('time-label').textContent,'t = 3.00','Switching equations preserves time');
assert.equal($('beta-control').hidden,false);assert.equal($('show-particular').disabled,true);assert.equal($('particular-legend').hidden,true);
assert.equal($('page-title').textContent,'Duffing oscillator');assert.match($('equation').textContent,/βx³/);
assert.equal($('response-heading').textContent,'Unforced potential');assert.equal($('phase-label').textContent,'Energy change dE/dt');
fire('beta-slider','input',.5);flush();assert.equal($('beta').value,'0.5');
fire('k','input',-1);flush();assert.equal($('k').attributes['aria-invalid'],'false');assert.equal($('regime').textContent,'Double well');
fire('model','change','harmonic');flush();assert.equal($('k').value,'1');assert.equal($('beta-control').hidden,true);assert.equal($('response-heading').textContent,'Frequency response');
fire('model','change','duffing');flush();assert.equal($('k').value,'-1');assert.equal($('beta').value,'0.5','Switching modes preserves each equation’s coefficients');
fire('preset','change','duffing-double-well');flush();assert.equal($('model').value,'duffing');assert.equal($('x0').value,'0.5');assert.equal($('regime').textContent,'Double well');
fire('start-time','input',-2);fire('duration','input',6);fire('restart','click');flush();assert.equal($('time-label').textContent,'t = -2.00');
fire('play','click');flush(3000);flush(3100);assert.equal($('time-label').textContent,'t = -1.90');
fire('beta','input',1.5);flush(3200);assert.equal($('time-label').textContent,'t = -1.80','Duffing edits preserve playback');
fire('play','click');flush();fire('timeline','input',0);flush();assert.equal($('current-x').textContent,'0.500');
fire('beta','input','');fire('beta','change');flush();assert.match($('input-error').textContent,/Cubic stiffness/);
fire('beta','input',-1);fire('x0','input',4);fire('duration','input',120);fire('timeline','input',120);flush();
assert.match($('range-note').textContent,/Numerical trajectory stops/);assert.equal($('current-x').textContent,'—');
const forcePath=contexts.get('time-canvas').paths.find(path=>path.color==='#f6b77b').points;
assert.ok(forcePath.length>400);assert.equal(forcePath[0][0],48);assert.equal(forcePath.at(-1)[0],580);
const lateForcing=forcePath.filter(([x])=>x>450).map(([,y])=>y);
assert.ok(lateForcing.length>20&&Math.max(...lateForcing)-Math.min(...lateForcing)>1e-5,'The force keeps oscillating after the numerical trajectory stops');
fire('preset','change','damped');flush();assert.equal($('model').value,'harmonic');assert.equal($('show-particular').disabled,false);assert.equal($('frequency-label').textContent,'Natural frequency √k');
fire('reset','click');flush();assert.equal($('time-label').textContent,'t = 0.00');assert.equal($('timeline').max,'40');
console.log('Passed: Duffing mode, cubic and negative linear stiffness, presets, signed playback, escape handling, and harmonic restoration.');

const clickPhase=(x,y,button=0)=>$('phase-canvas').listeners.click({clientX:120+x,clientY:80+y,button});
const count=()=>Number($('trajectory-count').textContent.split(' / ')[0]);
const initial=createSolution({b:.4,k:1,omega:.8}).sample(40);
const initialXRange=1.12*Math.max(.5,...initial.map(p=>Math.abs(p.x)));
const initialVRange=1.12*Math.max(.5,...initial.map(p=>Math.abs(p.v)));
fire('timeline','input',9);flush();
clickPhase(48+.8*(600-68),24+.7*(280-55));flush();
assert.equal(count(),2);assert.equal($('trajectory-select').value,'2');
assert.ok(Math.abs(Number($('x0').value)-.6*initialXRange)<1e-7,'Click maps CSS pixels, with page offset and DPR=2, into initial position');
assert.ok(Math.abs(Number($('v0').value)+.4*initialVRange)<1e-7,'Click maps downward screen motion to negative velocity');
assert.equal($('time-label').textContent,'t = 0.00');assert.equal($('current-x').textContent,Number($('x0').value).toFixed(3));
assert.ok(contexts.get('phase-canvas').paths.some(path=>path.color==='#61dfbd'&&path.points.length>100),'Original trajectory remains visible after adding another');
fire('trajectory-select','change',1);flush();assert.equal($('x0').value,'0');assert.equal($('v0').value,'0');
fire('trajectory-select','change',2);fire('x0','input',-2.5);fire('v0','input',1.5);flush();
fire('trajectory-select','change',1);flush();assert.equal($('x0').value,'0','Editing a selected path does not change another seed');
for(const [x,y] of [[10,100],[590,100],[100,10],[100,270]])clickPhase(x,y);
clickPhase(100,100,2);flush();assert.equal(count(),2,'Margins and secondary-button clicks do not add seeds');
$('phase-canvas').listeners.pointerdown({clientX:220,clientY:180});clickPhase(150,100);flush();assert.equal(count(),2,'Dragging does not add an unintended point');
for(const [u,v] of [[.25,.25],[.25,.75],[.75,.25],[.75,.75]]){
 clickPhase(48+u*(600-68),24+v*(280-55));flush();
 assert.equal(Math.sign(Number($('x0').value)),u<.5?-1:1);assert.equal(Math.sign(Number($('v0').value)),v<.5?1:-1);
}
assert.equal(count(),6);
fire('b','input',.2);fire('duration','input',60);fire('model','change','duffing');flush();assert.equal(count(),6,'Coefficient, time, and equation changes preserve the trajectory set');
for(let i=0;i<10;i++)fire('add-trajectory','click');flush();assert.equal(count(),12);assert.equal($('add-trajectory').disabled,true);assert.match($('trajectory-status').textContent,/12 trajectory slots/);
fire('remove-trajectory','click');flush();assert.equal(count(),11);assert.equal($('add-trajectory').disabled,false);assert.match($('trajectory-legend').innerHTML,/--trajectory-color:#61dfbd/,'Surviving paths retain their colors');
fire('keep-trajectory','click');flush();assert.equal(count(),1);assert.equal($('remove-trajectory').disabled,true);
fire('preset','change','duffing-chaos');flush();
assert.equal(count(),2);assert.equal($('model').value,'duffing');assert.equal($('beta').value,'0.25');assert.equal($('x0').value,'2.6');
assert.equal($('timeline').min,'0');assert.equal($('timeline').max,'250');assert.equal($('time-label').textContent,'t = 0.00');assert.equal($('regime').textContent,'Chaotic double well');
// Every trajectory animates even when it is not selected. Static future paths
// remain faint, while bright trails and their exact endpoints follow the clock.
const phaseSnapshot=color=>{
 const ctx=contexts.get('phase-canvas');
 const background=ctx.paths.find(path=>path.color===color&&path.alpha<.4&&path.points.length>100);
 const trail=ctx.paths.find(path=>path.color===color&&path.alpha===1&&path.width===2&&path.points.length>2);
 const connector=ctx.paths.filter(path=>path.color===color&&path.alpha===1&&path.width===2&&path.points.length===2).at(-1);
 const marker=ctx.arcs.filter(arc=>arc.color===color&&arc.r===4&&arc.filled).at(-1);
 assert.ok(background,'Every path has a faint full-window preview');
 assert.ok(trail,'Every path has a bright trail ending at the current time');
 assert.ok(marker&&connector,'Every trajectory has a visible moving marker and continuous endpoint');
 assert.deepEqual(connector.points.at(-1),[marker.x,marker.y],'The interpolated marker joins the end of its own trail');
 assert.ok(trail.points.length<background.points.length,'The animated trail does not include future points');
 return {count:trail.points.length,background:background.points,marker:[marker.x,marker.y],trail:trail.points};
};
fire('timeline','input',125.003);flush();
const phaseColors=['#61dfbd','#7fbfff'],beforeMotion=phaseColors.map(phaseSnapshot);
assert.ok(Math.hypot(...beforeMotion[0].marker.map((value,i)=>value-beforeMotion[1].marker[i]))>2,'At this time the chaotic paths have visibly separated');
fire('play','click');flush(4000);flush(4100);
const afterMotion=phaseColors.map(phaseSnapshot);
for(let i=0;i<2;i++){
 assert.notDeepEqual(afterMotion[i].marker,beforeMotion[i].marker,'Both markers move during playback');
 assert.ok(afterMotion[i].count>beforeMotion[i].count,'Both trails grow during playback');
 assert.strictEqual(afterMotion[i].background,beforeMotion[i].background,'Full-window paths stay cached while animation advances');
}
fire('play','click');flush();
fire('trajectory-select','change',2);flush();
const afterSelection=phaseColors.map(phaseSnapshot);
for(let i=0;i<2;i++)assert.deepEqual(afterSelection[i].trail,afterMotion[i].trail,'Selecting a path does not change which trails animate');
fire('timeline','input',55.003);flush();
for(let i=0;i<2;i++)assert.ok(phaseSnapshot(phaseColors[i]).count<afterMotion[i].count,'Both trails rewind when scrubbing backward');
fire('timeline','input',0);flush();
console.log('Passed: both chaotic trails and markers animate, remain continuous, and rewind independently of selection.');
fire('trajectory-select','change',2);flush();assert.ok(Math.abs(Number($('x0').value)-2.60001)<1e-12);assert.equal($('time-label').textContent,'t = 0.00','Selecting a trajectory preserves time');
fire('duration','input',500);fire('timeline','input',500);flush();assert.equal($('time-label').textContent,'t = 500.00');assert.notEqual($('current-x').textContent,'—');assert.equal($('range-note').textContent,'');
fire('start-time','input',-500);fire('restart','click');flush();assert.equal($('timeline').min,'-500');assert.equal($('current-x').textContent,'—');assert.match($('range-note').textContent,/Numerical trajectory stops/);
fire('timeline','input',250);flush();assert.notEqual($('current-x').textContent,'—','Forward path remains usable after backward calculation stops');
fire('duration','input',-100);fire('restart','click');flush();assert.equal($('current-x').textContent,'—');assert.match($('range-note').textContent,/Numerical trajectory stops/,'A fully truncated negative window is explained');
fire('duration','input',500);fire('duration','input',501);fire('duration','change');flush();assert.equal($('timeline').max,'500');assert.match($('input-error').textContent,/between -500 and 500/);
fire('reset','click');flush();assert.equal(count(),1);assert.equal($('timeline').min,'0');assert.equal($('timeline').max,'40');assert.equal($('trajectory-status').textContent,'');
fire('preset','change','beats');fire('omega','input',10);fire('start-time','input',-500);fire('duration','input',500);flush();
assert.equal($('input-error').textContent,'');assert.equal($('timeline').max,'500');assert.equal($('range-note').textCont