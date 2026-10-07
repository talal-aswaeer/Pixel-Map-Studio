const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const path=require('path'),root=path.resolve(__dirname,'..');fs.mkdirSync(root+'/outputs',{recursive:true});
function setup(html,studio=false){
 const exports=[],blobs=[],calls=[],elements=new Map(),listeners={};
 const context=new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>k in o?o[k]:(...a)=>calls.push([k,...a]),set:(o,k,v)=>(o[k]=v,true)});
 const makeElement=()=>({style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(k,fn){listeners[k]=fn;},getContext:()=>context,clientWidth:900,clientHeight:600,getBoundingClientRect:()=>({left:0,top:0,width:900,height:600}),toDataURL:()=>'',toBlob(fn){exports.push({kind:'png',width:this.width,height:this.height});fn({});},click(){},setAttribute(){},querySelector:()=>null,querySelectorAll:()=>[],replaceChildren(){},append(){},insertBefore(){},remove(){}});
 const document={getElementById:id=>{if(!elements.has(id))elements.set(id,makeElement());return elements.get(id)},querySelectorAll:()=>[],querySelector:makeElement,addEventListener(){},createElement:makeElement,fonts:{ready:{then(){}}},body:{appendChild(){}}};
 class Image{naturalWidth=400;naturalHeight=100;}
 class Blob{constructor(parts,options){this.parts=parts;this.type=options.type;blobs.push(this);}}
 const env={document,window:{addEventListener(){}},crypto,Image,FileReader:class{},Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},setTimeout(){},clearTimeout(){},queueMicrotask(){},console};
 vm.createContext(env);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],env);
 vm.runInContext('enhancePanel=()=>{};updateWorkspaceReadout=()=>{};',env);
 if(studio)vm.runInContext(fs.readFileSync(root+'/studio.js','utf8'),env);
 return{env,exports,blobs,calls,listeners,run:code=>vm.runInContext(code,env)};
}
const baseline=setup(fs.readFileSync(__dirname+'/baseline.html','utf8'));
const studio=setup(fs.readFileSync(root+'/index.html','utf8'),true);
for(const fn of ['gRes','sDimsM','getScreenBBox','edgeSnap','drawScreen','drawCustomScreen','drawScreenExport','drawCustomScreenExport','buildScreenSVG','buildCustomSVGScreen']){const original=baseline.run(fn+'.toString()').replaceAll('ctx.fillText(`SCREEN ${label}`',"ctx.fillText(`${s.labelMode==='custom'?'':'SCREEN '}${label}`").replaceAll('>SCREEN ${esc(label)}</text>',">${s.labelMode==='custom'?'':'SCREEN '}${esc(label)}</text>");assert.equal(original,studio.run(fn+'.toString()'),fn+' changed beyond the custom-label correction');}
for(const mode of ['led','custom']){
 const configure=`appMode='${mode}';${mode==='led'?'screens=[mkScreen(0),mkScreen(1)];screens[0].widthM=4;screens[1].widthM=2;screens[1].posX=4;':'customScreens=[mkCustomScreen(0),mkCustomScreen(1)];customScreens[0].resW=800;customScreens[1].resW=400;customScreens[1].posX=20;'};curList().forEach(s=>{s.brandMode='none';});`;
 baseline.run(configure);studio.run(configure);
 const exporting=mode==='led'?'exportPNG();exportSVG();':'cExportPNG();cExportSVG();';
 baseline.run(exporting);studio.run(exporting);
 assert.deepEqual(studio.exports.at(-1),baseline.exports.at(-1));assert.equal(studio.blobs.at(-1).parts.join(''),baseline.blobs.at(-1).parts.join(''),'Layer-free export must match original exactly');
 studio.run("addMask();layerValue('width',256);layerValue('height',205);layerValue('x',125);layerValue('y',30);layerValue('opacity',50);");studio.run(exporting);
 const svg=studio.blobs.at(-1).parts.join('');assert(svg.includes('x="125" y="30" width="256" height="205"'));assert(svg.includes('<g data-layer-opacity="0.5">'));assert(svg.includes('fill-opacity="0.1"'));assert(studio.calls.some(c=>c[0]==='fillRect'&&c[1]===125&&c[2]===30&&c[3]===256&&c[4]===205));
 studio.run('toggleLayer(selectedLayer)');assert.equal(studio.run('overlaySVG(cardBounds().minX,cardBounds().minY,cardBounds().density)'), '');studio.run('deleteLayer()');
}
studio.run("appMode='led';screens=[mkScreen(0)];addMask();layerUnit('cm');layerValue('width',0.5);layerValue('height',0.5);");
assert.equal(studio.run('layerPixels(activeLayer()).width'),1.28);studio.run("layerUnit('px')");assert.equal(studio.run('activeLayer().width'),1.28);
studio.run("appMode='custom';customScreens=[mkCustomScreen(0),mkCustomScreen(1),mkCustomScreen(2)];customScreens[0].resW=4096;customScreens[1].resW=7424;customScreens[2].resW=4096;customScreens.forEach((s,i)=>{s.resH=1408;s.labelMode='custom';s.screenLabel=['C','A','B'][i];s.showGrid=true;s.gridDensity=Math.round(s.resW/128);s.brandMode='none';});cLayoutMode='auto';drawCustomAll();addMask();layerValue('x',4096);layerValue('y',1203);layerValue('width',7424);layerValue('height',205);cExportSVG();cExportPNG();");
assert.equal(studio.exports.at(-1).width,15616);assert.equal(studio.exports.at(-1).height,1408);
fs.writeFileSync(root+'/outputs/reference-layout.svg',studio.blobs.at(-1).parts.join(''));
console.log('PASS: original screen drawing and layer-free exports preserved; exact pixel/cm sizing; LED/custom PNG and SVG overlay geometry, opacity, visibility; reference 15616 × 1408 layout.');
module.exports={setup,root};
