const {setup,root}=require('./layers.cjs');
const fs=require('fs'),assert=require('assert/strict');
const h=setup(fs.readFileSync(root+'/index.html','utf8'),true);
const drawn=[];
h.env.labelContext=new Proxy({},{get:(_,key)=>(...args)=>{if(key==='measureText')return {width:String(args[0]).length*7};if(key==='fillText')drawn.push(args[0]);},set:()=>true});
for(const mode of ['led','custom']) {
  h.run(`appMode='${mode}';labelScreen=${mode==='led'?'mkScreen(0)':'mkCustomScreen(0)'};labelScreen.brandMode='none';`);
  for(const [labelMode,text,expected] of [['auto','Stage','SCREEN A'],['custom','Stage','Stage'],['custom','SCREEN A','SCREEN A'],['custom','A&B <C>','A&B <C>'],['custom','',''],['none','Stage','']]) {
    h.env.labelMode=labelMode;h.env.labelText=text;
    h.run('labelScreen.labelMode=labelMode;labelScreen.screenLabel=labelText;');
    h.calls.length=0;
    h.run(`${mode==='led'?'drawScreen':'drawCustomScreen'}(labelScreen,0)`);
    const preview=h.calls.filter(c=>c[0]==='fillText').map(c=>c[1]);
    drawn.length=0;
    h.run(`${mode==='led'?'drawScreenExport':'drawCustomScreenExport'}(labelContext,labelScreen,0,0,0,800,400)`);
    const svg=h.run(`${mode==='led'?'buildScreenSVG':'buildCustomSVGScreen'}(labelScreen,0,0,0,800,400)`);
    if(expected) {
      assert(preview.includes(expected),mode+' preview label');
      assert(drawn.includes(expected),mode+' PNG label');
      const escaped=expected.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      assert(svg.includes('>'+escaped+'</text>'),mode+' SVG label');
    }
    const wrong='SCREEN '+(text||'A');
    if(labelMode!=='auto') {assert(!preview.includes(wrong));assert(!drawn.includes(wrong));assert(!svg.includes('>SCREEN '+text+'</text>'));}
    if(!expected) {assert(!preview.some(t=>t.startsWith('SCREEN ')));assert(!drawn.some(t=>t.startsWith('SCREEN ')));}
  }
}
console.log('PASS: automatic, custom, already-prefixed, escaped, empty, and hidden labels match in both previews and PNG/SVG exports.');
