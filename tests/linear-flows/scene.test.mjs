import assert from 'node:assert/strict';
import {MAX_3D_RANGE,scene3D,grid3DLines} from '../../dist/apps/linear-flows/js/scene.js';

for(const range of [0.5,4,5,6.25,10,40,160,1e8,1e100,MAX_3D_RANGE]){
 for(const [width,height] of [[900,400],[400,900],[4000,250]]){
  for(const [yaw,pitch] of [[.65,.5],[0,0],[1.8,-1.4]]){
   const scene=scene3D(range,width,height,yaw,pitch);
   assert.ok(scene.counts.reduce((n,count)=>n*(2*count+1),1)<=4096);
   const lines=[...grid3DLines(scene)];
   assert.ok(lines.length>12&&lines.length<=2000,'A bounded repeating lattice fills the view');
   assert.equal(new Set(lines.map(line=>line.axis)).size,3,'Lines run along all three axes');
   const keys=new Set();
   for(const {axis,a,b} of lines){
    const others=[0,1,2].filter(i=>i!==axis);
    assert.equal(a[axis],-scene.gridExtents[axis]);assert.equal(b[axis],scene.gridExtents[axis]);
    for(const i of others){assert.equal(a[i],b[i]);assert.ok(Number.isInteger(a[i]/scene.gridStep),'Grid coordinates are periodic integer multiples of one shared step');}
    keys.add([axis,...others.map(i=>a[i]/scene.gridStep)].join(','));
   }
   assert.equal(keys.size,lines.length,'Every lattice line is drawn once');
   assert.ok([scene.radius,scene.gridStep,scene.fieldStep,scene.fieldLength,...scene.gridExtents,...scene.counts].every(Number.isFinite));
   // Every viewport corner and both ends of the depth slab are inside the lattice.
   const scale=Math.min(width,height)/(2*range),u=width/(2*scale),v=height/(2*scale);
   const c=Math.cos(yaw),s=Math.sin(yaw),p=Math.sin(pitch),q=Math.cos(pitch);
   for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){
    const point=[c*sx*u+p*s*sy*v+q*s*sz*range,-s*sx*u+p*c*sy*v+q*c*sz*range,q*sy*v-p*sz*range];
    point.forEach((value,i)=>{
     assert.ok(Math.abs(value)<=scene.counts[i]*scene.fieldStep*(1+1e-12));
     assert.ok(Math.abs(value)<=scene.gridExtents[i]*(1+1e-12),'Grid covers viewport and depth bounds');
    });
   }
  }
 }
}
assert.equal(scene3D(5,900,400,.65,.5).gridStep,scene3D(6.25,900,400,.65,.5).gridStep,'Small zoom changes keep existing grid positions');
assert.ok(scene3D(1e8,900,400,.65,.5).radius>1e7);
console.log('Passed: periodic cubic grid, bounded sampling, camera coverage, and numeric extremes.');
