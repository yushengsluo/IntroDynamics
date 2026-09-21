import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../dist/assets/js/theme.js',import.meta.url),'utf8');
const storageKey='dynamics-theme';

function boot({dark=false,storage=new Map(),failStorage=false,mediaSupported=true}={}){
 const documentListeners=new Map(),windowListeners=new Map(),mediaListeners=new Map(),events=[];
 const icon={textContent:''};
 const button={attributes:{},title:'',listeners:new Map(),
  setAttribute(name,value){this.attributes[name]=value;},
  querySelector(selector){return selector==='[data-theme-icon]'?icon:null;},
  addEventListener(type,listener){this.listeners.set(type,listener);}
 };
 const previews=['linear-flows','forced-oscillator'].map(name=>({
  attributes:{src:name+'.svg','data-dark-src':name+'.svg','data-light-src':name+'-light.svg'},
  getAttribute(name){return this.attributes[name]??null;},
  setAttribute(name,value){this.attributes[name]=value;}
 }));
 let loaded=false;
 const document={documentElement:{dataset:{}},
  querySelectorAll(selector){return !loaded?[]:selector==='[data-theme-toggle]'?[button]:selector==='[data-light-src]'?previews:[];},
  addEventListener(type,listener){documentListeners.set(type,listener);}
 };
 const media={matches:dark,addEventListener(type,listener){mediaListeners.set(type,listener);}};
 const window={
  ...(mediaSupported?{matchMedia(query){assert.equal(query,'(prefers-color-scheme: dark)');return media;}}:{}),
  addEventListener(type,listener){windowListeners.set(type,listener);},
  dispatchEvent(event){events.push(event);windowListeners.get(event.type)?.(event);}
 };
 const localStorage={
  getItem(key){if(failStorage)throw new Error('Storage blocked');return storage.get(key)??null;},
  setItem(key,value){if(failStorage)throw new Error('Storage blocked');storage.set(key,value);}
 };
 const context={window,document,localStorage,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
 vm.runInNewContext(source,context,{filename:'theme.js'});
 const app={window,document,button,icon,previews,storage,events,
  ready(){loaded=true;documentListeners.get('DOMContentLoaded')?.();},
  toggle(){button.listeners.get('click')?.();},
  setSystem(next){media.matches=next;mediaListeners.get('change')?.({matches:next});},
  storageEvent(key,newValue){windowListeners.get('storage')?.({key,newValue});},
  get theme(){return document.documentElement.dataset.theme;}
 };
 return app;
}

function expectAppearance(app,theme){
 assert.equal(app.theme,theme);
 assert.equal(app.window.AppTheme.isLight(),theme==='light');
 const next=theme==='light'?'dark':'light';
 assert.equal(app.button.attributes['aria-label'],`Switch to ${next} mode`);
 assert.equal(app.button.title,`Switch to ${next} mode`);
 assert.equal(app.icon.textContent,theme==='dark'?'☀':'☾');
 for(const preview of app.previews)assert.equal(preview.attributes.src,preview.attributes[`data-${theme}-src`]);
 assert.equal(app.events.at(-1).type,'themechange');
 assert.equal(app.events.at(-1).detail.theme,theme,'Canvas listeners receive the current appearance');
}

for(const dark of [false,true]){
 const app=boot({dark});
 assert.equal(app.theme,dark?'dark':'light','The initial theme is set before the page content loads');
 app.ready();expectAppearance(app,dark?'dark':'light');
 app.setSystem(!dark);expectAppearance(app,dark?'light':'dark');
 assert.equal(app.storage.has(storageKey),false,'Following the OS does not create an explicit preference');
}

for(const theme of ['light','dark']){
 const storage=new Map([[storageKey,theme]]),app=boot({dark:theme==='light',storage});
 app.ready();expectAppearance(app,theme);
 app.setSystem(theme==='dark');app.setSystem(theme!=='dark');
 expectAppearance(app,theme,'Saved preferences override later OS changes');
 app.toggle();const selected=theme==='light'?'dark':'light';
 expectAppearance(app,selected);assert.equal(storage.get(storageKey),selected);
 const fresh=boot({dark:selected!=='dark',storage});fresh.ready();expectAppearance(fresh,selected);
 fresh.setSystem(selected==='dark');fresh.setSystem(selected!=='dark');expectAppearance(fresh,selected);
}

const invalid=boot({dark:true,storage:new Map([[storageKey,'invalid-theme']])});
invalid.ready();expectAppearance(invalid,'dark');invalid.setSystem(false);expectAppearance(invalid,'light');

const synced=boot({dark:true});synced.ready();
synced.storageEvent(storageKey,'light');expectAppearance(synced,'light');
synced.setSystem(false);synced.setSystem(true);expectAppearance(synced,'light');
const eventCount=synced.events.length;
synced.storageEvent('unrelated-setting','dark');expectAppearance(synced,'light');assert.equal(synced.events.length,eventCount);
synced.storageEvent(storageKey,'dark');expectAppearance(synced,'dark');
synced.storageEvent(storageKey,null);expectAppearance(synced,'dark');
synced.setSystem(false);expectAppearance(synced,'light');
synced.storageEvent(storageKey,'dark');expectAppearance(synced,'dark');
synced.storageEvent(null,null);expectAppearance(synced,'light');
synced.setSystem(true);expectAppearance(synced,'dark');

const blocked=boot({failStorage:true,dark:false});blocked.ready();expectAppearance(blocked,'light');
blocked.toggle();expectAppearance(blocked,'dark');
blocked.setSystem(true);blocked.setSystem(false);expectAppearance(blocked,'dark');
blocked.toggle();expectAppearance(blocked,'light');

const noMedia=boot({mediaSupported:false});noMedia.ready();expectAppearance(noMedia,'light');
noMedia.toggle();expectAppearance(noMedia,'dark');
console.log('Passed: theme initialization, saved preference, controls, preview assets, persistence, cross-tab synchronization, OS changes, blocked storage, and canvas notifications.');
