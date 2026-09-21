// Canvas colors are read at draw time so a theme change preserves the simulation.
const dark={
 colors:['#61dfbd','#b39af1','#f3ac77','#72bafa','#f281a6','#dfd075'],
 surface:'#141414',grid:'#292929',axis:'#606060',tick:'#989898',label:'#c8c8c8',
 grid3D:'#6d6d6d55',grid3DMajor:'#80808066',axes3D:['#568c80','#756caa','#94765d'],
 sliceFill:'#61dfbd0c',sliceStroke:'#61dfbd50',field2D:'#4c71847a',field3D:'#47677e6b',
 markerOutline:'#09201b',hover:'#e4fff6',hoverText:'#d0f8e9',origin:'#eeeeee',cursor:'#c3c3c382',
 trace:{saddle:'#302522',stableNode:'#1c3029',unstableNode:'#332b22',stableSpiral:'#222e36',unstableSpiral:'#312a35',unavailable:'#111111cc',grid:'#bdbdbd19',axis:'#999999',curve:'#bea5ee',center:'#61dfbd',stableSpiralText:'#91b8d8',unstableSpiralText:'#d2acd8',stableNodeText:'#83c4ac',unstableNodeText:'#d7ae86',saddleText:'#d3a185',point:'#61dfbd',pointOutline:'#eafff8'}
};
const light={
 colors:['#087f66','#7651b7','#a8580c','#216eb6','#b33b67','#8b7510'],
 surface:'#fafafa',grid:'#e2e2e2',axis:'#999999',tick:'#696969',label:'#454545',
 grid3D:'#8d8d8d35',grid3DMajor:'#78787850',axes3D:['#337e6e','#77649c','#956d48'],
 sliceFill:'#087f6609',sliceStroke:'#087f6660',field2D:'#526c7685',field3D:'#526c7670',
 markerOutline:'#ffffff',hover:'#16634f',hoverText:'#16634f',origin:'#333333',cursor:'#58585882',
 trace:{saddle:'#f5e6df',stableNode:'#e0f0e7',unstableNode:'#f5eada',stableSpiral:'#e2edf5',unstableSpiral:'#ede4f3',unavailable:'#f4f4f4cc',grid:'#57575719',axis:'#888888',curve:'#7651b7',center:'#087f66',stableSpiralText:'#355e80',unstableSpiralText:'#795386',stableNodeText:'#286849',unstableNodeText:'#895d25',saddleText:'#895438',point:'#087f66',pointOutline:'#ffffff'}
};
export function plotPalette(){return globalThis.window?.AppTheme?.isLight?.()?light:dark;}
