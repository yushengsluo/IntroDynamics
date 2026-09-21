import {DEFAULT_RANGE} from './coordinates.js';

export const BASE_RADIUS=DEFAULT_RANGE*.64;
export const MAX_3D_RANGE=Number.MAX_VALUE/65536;
const BASE_FIELD_STEP=BASE_RADIUS/2;
const MAX_FIELD_SAMPLES=4096;
const MAX_GRID_LINES=2000;
const gridLineCount=counts=>counts.reduce((total,_,axis)=>total+counts.filter((_,i)=>i!==axis).reduce((product,n)=>product*(2*n+1),1),0)-3;

// Extents grow in world-space steps, so the existing geometry still moves with zoom.
export function scene3D(range,width,height,yaw,pitch){
 const level=Math.max(0,Math.floor(Math.log2(range/DEFAULT_RANGE)));
 const radius=BASE_RADIUS*2**level;
 const scale=Math.min(width,height)/(2*range),u=width/(2*scale),v=height/(2*scale),depth=range;
 const c=Math.cos(yaw),s=Math.sin(yaw),p=Math.sin(pitch),q=Math.cos(pitch);
 const screenX=[c,-s,0],screenY=[p*s,p*c,q],screenZ=[q*s,q*c,-p];
 const bounds=screenX.map((x,i)=>Math.abs(x)*u+Math.abs(screenY[i])*v+Math.abs(screenZ[i])*depth);
 // Choose spacing for this whole zoom tier, rather than toggling it on small scrolls.
 const samplingRange=DEFAULT_RANGE*2**(level+1),samplingBounds=bounds.map(bound=>bound*(samplingRange/range));
 let fieldStep=BASE_FIELD_STEP*2**level;
 while(samplingBounds.map(bound=>Math.ceil(bound/fieldStep)).reduce((product,count)=>product*(2*count+1),1)>MAX_FIELD_SAMPLES)fieldStep*=2;
 const counts=bounds.map(bound=>Math.ceil(bound/fieldStep));
 let gridStep=2**level;
 while(gridLineCount(samplingBounds.map(bound=>Math.ceil(bound/gridStep)))>MAX_GRID_LINES)gridStep*=2;
 const gridCounts=bounds.map(bound=>Math.ceil(bound/gridStep)),gridExtents=gridCounts.map(count=>count*gridStep);
 return{radius,gridStep,gridCounts,gridExtents,fieldStep,counts,fieldLength:fieldStep*.28125};
}

// Three perpendicular line families form equal-sized cells throughout space.
export function* grid3DLines({gridStep,gridCounts,gridExtents}){
 for(let axis=0;axis<3;axis++){
  const [u,v]=[0,1,2].filter(i=>i!==axis);
  for(let i=-gridCounts[u];i<=gridCounts[u];i++)for(let j=-gridCounts[v];j<=gridCounts[v];j++){
   if(i===0&&j===0)continue; // Coordinate axes are drawn separately.
   const a=[0,0,0],b=[0,0,0];
   a[axis]=-gridExtents[axis];b[axis]=gridExtents[axis];
   a[u]=b[u]=i*gridStep;a[v]=b[v]=j*gridStep;
   yield{axis,a,b,major:i===0||j===0};
  }
 }
}
