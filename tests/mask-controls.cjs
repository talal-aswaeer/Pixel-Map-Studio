const {setup,root}=require('./layers.cjs');const fs=require('fs'),assert=require('assert/strict');
(async()=>{
const h=setup(fs.readFileSync(root+'/index.html','utf8'),true);
h.run('addMask();');
for(const [x,y,density,bypass,expected] of [[70,-70,256,false,[128,-128]],[150,250,384,false,[192,192]],[170,90,320.5,false,[160.25,160.25]],[70,-70,256,true,[70,-70]]]){
const p=h.run(`snappedLayerPosition(activeLayer(),${x},${y},${density},${bypass})`);assert.equal(p.x,expected[0]);assert.equal(p.y,expected[1]);
}
h.run("layerValue('snapToGrid',false);");assert.equal(h.run('snappedLayerPosition(activeLayer(),70,70).x'),70);
h.run("layerValue('snapToGrid',true);layerValue('width',256);layerValue('height',205);layerValue('hatchCount',10);");
assert.equal(h.run('hatchSpacing(activeLayer())'),461/11);
let moves=[];h.env.probe=new Proxy({},{get:(o,k)=>(...args)=>{if(k==='moveTo')moves.push(args);},set:(o,k,v)=>(o[k]=v,true)});
h.run('renderOverlays(probe,cardBounds().minX,cardBounds().minY,cardBounds().density)');assert.equal(moves.length,10,'Canvas draws exactly ten hatch lines');
h.run('layerValue("hatchCount",0)');moves=[];h.run('renderOverlays(probe,cardBounds().minX,cardBounds().minY,cardBounds().density)');assert.equal(moves.length,0);assert(!h.run('overlaySVG(0,0,cardBounds().density)').includes('<pattern'));
h.run('layerValue("hatchCount",20);commitHistory();layerValue("hatchCount",50);commitHistory();undoDocument();');assert.equal(h.run('activeLayer().hatchCount'),20);h.run('redoDocument()');assert.equal(h.run('activeLayer().hatchCount'),50);
h.run("defaultLogoDataURL='data:image/png;base64,AAAA';layerValue('snapToGrid',false);commitHistory();");
const project=await h.run('buildProject()');h.env.project=project;
assert.equal(h.run('validateProject(project).state.overlays[0].hatchCount'),50);assert.equal(h.run('validateProject(project).state.overlays[0].snapToGrid'),false);
const legacy=JSON.parse(JSON.stringify(project));delete legacy.document.overlays[0].hatchCount;delete legacy.document.overlays[0].snapToGrid;h.env.legacy=legacy;
assert.equal(h.run('validateProject(legacy).state.overlays[0].snapToGrid'),true);assert.equal(h.run('validateProject(legacy).state.overlays[0].hatchCount'),undefined);
h.run("delete activeLayer().hatchCount;layerValue('width',7424);layerValue('height',205);");assert.equal(h.run('hatchLineCount(activeLayer())'),59);assert.equal(h.run('hatchSpacing(activeLayer())'),128);
h.run("activeLayer().mode='custom';appMode='custom';");assert.equal(h.run('snappedLayerPosition(activeLayer(),70.3,81.8).x'),70);
const invalid=JSON.parse(JSON.stringify(project));invalid.document.overlays[0].hatchCount=2.5;h.env.invalid=invalid;assert.throws(()=>h.run('validateProject(invalid)'));
// Uploaded images share the grid controls and preserve the setting on file import.
const image=setup(fs.readFileSync(root+'/index.html','utf8'),true);
image.run("readImageFile=async()=>({data:'data:image/png;base64,AAAA',img:{naturalWidth:400,naturalHeight:100}});defaultLogoDataURL='data:image/png;base64,AAAA';");
await image.run("uploadOverlay({name:'Image mask.png'})");
assert.equal(image.run('activeLayer().snapToGrid'),true);
assert(image.env.document.getElementById('layerPanel').innerHTML.includes('Snap movement to 0.5 m'));
for(const [density,bypass,expected] of [[256,false,128],[384,false,192],[320.5,false,160.25],[256,true,100]])assert.equal(image.run(`snappedLayerPosition(activeLayer(),100,100,${density},${bypass}).x`),expected);
image.run("commitHistory();layerValue('snapToGrid',false);commitHistory();");
assert.equal(image.run('snappedLayerPosition(activeLayer(),100,100).x'),100);
image.run('undoDocument()');assert.equal(image.run('activeLayer().snapToGrid'),true);
image.run('redoDocument()');assert.equal(image.run('activeLayer().snapToGrid'),false);
const imageProject=await image.run('buildProject()');image.env.imageProject=imageProject;
assert.equal(image.run('validateProject(imageProject).state.overlays[0].snapToGrid'),false);
delete imageProject.document.overlays[0].snapToGrid;
assert.equal(image.run('validateProject(imageProject).state.overlays[0].snapToGrid'),true);
imageProject.document.overlays[0].snapToGrid='false';assert.throws(()=>image.run('validateProject(imageProject)'));
image.run("activeLayer().snapToGrid=true;activeLayer().mode='custom';appMode='custom';renderLayerPanel();");
assert.equal(image.run('snappedLayerPosition(activeLayer(),100.2,80.8).x'),100);
assert(!image.env.document.getElementById('layerPanel').innerHTML.includes('Snap movement to 0.5 m'));
console.log('PASS: 0.5 m mask snapping across pitches, Shift/free/custom behavior, exact hatch count including zero, undo/redo, project persistence, and older-file compatibility.');
})().catch(e=>{console.error(e);process.exitCode=1});
