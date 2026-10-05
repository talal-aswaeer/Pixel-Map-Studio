const {setup,root}=require('./layers.cjs');const fs=require('fs');
const h=setup(fs.readFileSync(root+'/index.html','utf8'),true);
h.env.logo='data:image/png;base64,'+fs.readFileSync(root+'/images/logo.png').toString('base64');
(async()=>{
 h.run("defaultLogoDataURL=logo;defaultLogoImg={naturalWidth:8136,naturalHeight:4628};screens=[mkScreen(0),mkScreen(1),mkScreen(2)];screens.forEach((s,i)=>{s.widthM=[16,29,16][i];s.heightM=5.5;s.labelMode='custom';s.screenLabel=['C','A','B'][i];s.bgColor=['#0c191b','#14161e','#190f1e'][i];});autoLayout('horizontal');pixelMapName='Stage example';addMask();layerValue('name','Screen A overlap');layerValue('x',4096);layerValue('y',1203);layerValue('width',7424);layerValue('height',205);commitHistory();");
 const p=await h.run('buildProject()');fs.writeFileSync(root+'/outputs/stage-example.tcmap',JSON.stringify(p,null,2));
 h.run('exportSVG()');fs.writeFileSync(root+'/outputs/stage-example.svg',h.blobs.at(-1).parts.join(''));
 console.log('Created local 15616 × 1408 example with the 7424 × 205 Screen A mask.');
})().catch(e=>{console.error(e);process.exitCode=1});
