const {setup,root}=require('./layers.cjs');const fs=require('fs'),assert=require('assert/strict');
const h=setup(fs.readFileSync(root+'/index.html','utf8'),true);
const logo='data:image/png;base64,'+fs.readFileSync(root+'/images/logo.png').toString('base64');
(async()=>{
 h.env.testLogo=logo;
 h.run("defaultLogoDataURL=testLogo;defaultLogoImg={naturalWidth:400,naturalHeight:100};screens.forEach(s=>s.logoImg=defaultLogoImg);customScreens.forEach(s=>s.logoImg=defaultLogoImg);appMode='custom';customScreens=[mkCustomScreen(0),mkCustomScreen(1),mkCustomScreen(2)];customScreens[0].resW=4096;customScreens[1].resW=7424;customScreens[2].resW=4096;customScreens.forEach((s,i)=>{s.resH=1408;s.labelMode='custom';s.screenLabel=['C','A','B'][i];s.showGrid=true;s.gridDensity=Math.round(s.resW/128);s.brandMode='both';});cLayoutMode='auto';drawCustomAll();pixelMapName='Stage reference';addMask();layerValue('name','Stage overlap');layerValue('x',4096);layerValue('y',1203);layerValue('width',7424);layerValue('height',205);commitHistory();");
 const project=await h.run('buildProject()');assert.equal(project.format,'andrei-test-card');assert.equal(project.version,1);assert.equal(Object.keys(project.assets).length,1,'Shared default logos should be embedded once');
 h.env.testProject=project;h.run('validateProject(testProject)');
 fs.writeFileSync(root+'/outputs/stage-reference.tcmap',JSON.stringify(project,null,2));
 h.run("decodeImage=async data=>({naturalWidth:400,naturalHeight:100,source:data});pixelMapName='Unsaved work';commitHistory();");
 h.env.projectFile={size:JSON.stringify(project).length,text:async()=>JSON.stringify(project)};
 await h.run('openProjectFile(projectFile)');assert.equal(h.run('pixelMapName'),'Stage reference');assert.equal(h.run('activeLayer().width'),7424);assert.equal(h.run('customScreens[1].logoDataURL'),logo);
 h.run('undoDocument()');assert.equal(h.run('pixelMapName'),'Unsaved work');h.run('redoDocument()');assert.equal(h.run('pixelMapName'),'Stage reference');
 const invalids=[
  p=>p.version=999,
  p=>p.document.customScreens[0].resW=-1,
  p=>p.document.overlays[0].id='\" onclick=\"bad',
  p=>p.document.overlays[0].spacing=0,
  p=>p.document.screens[0].logoAsset='asset-999',
  p=>p.assets['asset-1'].data='https://example.com/image.png',
  p=>p.document.overlays.push({...p.document.overlays[0]}),
  p=>p.document.customScreens=[]
 ];
 for(const mutate of invalids){const p=JSON.parse(JSON.stringify(project));mutate(p);h.env.invalidProject=p;assert.throws(()=>h.run('validateProject(invalidProject)'));}
 const before=h.run('stateSignature(captureState())');
 h.run("decodeImage=async()=>{throw new Error('Unreadable image');}");h.env.projectFile={size:100,text:async()=>JSON.stringify(project)};await h.run('openProjectFile(projectFile)');assert.equal(h.run('stateSignature(captureState())'),before);
 h.run("decodeImage=async data=>({naturalWidth:400,naturalHeight:100,source:data});");h.env.projectFile={size:7,text:async()=>'{broken'};await h.run('openProjectFile(projectFile)');assert.equal(h.run('stateSignature(captureState())'),before);
 // Imported images get independent runtime keys, preserving the old image on undo.
 const photo={...project.document.overlays[0],type:'image',id:'layer-photo',name:'Photo',asset:'asset-1'};
 h.env.photo=photo;h.run("layerAssets.set('original-photo',{data:testLogo,img:{source:'old'}});overlays.push({...photo,assetId:'original-photo'});selectedLayer=photo.id;commitHistory();");
 const photoProject=JSON.parse(JSON.stringify(project));photoProject.document.overlays=[photo];photoProject.document.selectedLayer=photo.id;
 h.env.projectFile={size:100,text:async()=>JSON.stringify(photoProject)};await h.run('openProjectFile(projectFile)');assert.notEqual(h.run('activeLayer().assetId'),'original-photo');h.run('undoDocument()');assert.equal(h.run('layerAssets.get(activeLayer().assetId).img.source'),'old');
 console.log('PASS: full .tcmap round trip with embedded deduplicated logos, masks and images; undo import; malformed/unknown-version/missing-asset rejection without document changes; imported image isolation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
