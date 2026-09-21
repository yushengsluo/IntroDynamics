export function pointOnSlice(u,v,yaw,pitch,axis,fixed){
 const c=Math.cos(yaw),s=Math.sin(yaw),p=Math.sin(pitch),q=Math.cos(pitch);
 const base=[c*u+p*s*v,-s*u+p*c*v,q*v],ray=[q*s,q*c,-p];
 if(Math.abs(ray[axis])<.12)return null;
 const distance=(fixed-base[axis])/ray[axis],point=base.map((x,i)=>x+distance*ray[i]);
 point[axis]=fixed;
 return point.every(Number.isFinite)?point:null;
}
