'use strict';
// Layers use export-pixel coordinates, measured from the complete card's top left.
// This keeps a 256 px mask at 256 px regardless of preview zoom or LED pitch.
let overlays = [], selectedLayer = null, editor = 'screens';
const layerAssets = new Map();
const studioEl = id => document.getElementById(id);
const uid = () => 'layer-' + crypto.randomUUID();
function cardBounds() {
  const boxes = curList().map(getScreenBBox);
  const minX = Math.min(...boxes.map(b=>b.minX)), minY = Math.min(...boxes.map(b=>b.minY));
  const maxX = Math.max(...boxes.map(b=>b.maxX)), maxY = Math.max(...boxes.map(b=>b.maxY));
  const density = appMode === 'led' ? gRes(screens[0]).resW/screens[0].widthM : PPM;
  return {minX,minY,maxX,maxY,density,width:Math.round((maxX-minX)*density),height:Math.round((maxY-minY)*density)};
}
function modeLayers() { return overlays.filter(l=>l.mode===appMode); }
function activeLayer() { return overlays.find(l=>l.id===selectedLayer && l.mode===appMode); }
function layerPixels(l, density=cardBounds().density) {
  const factor = l.unit==='cm' ? density/100 : l.unit==='m' ? density : 1;
  return {x:l.x,y:l.y,width:l.width*factor,height:l.height*factor};
}
function hatchLineCount(l,density=cardBounds().density) {
  if(Number.isInteger(l.hatchCount))return l.hatchCount;
  const p=layerPixels(l,density);
  return Math.max(0,Math.floor((p.width+p.height-1e-8)/l.spacing));
}
function hatchSpacing(l,density=cardBounds().density) {
  if(!Number.isInteger(l.hatchCount))return l.spacing;
  const p=layerPixels(l,density);return (p.width+p.height)/(l.hatchCount+1);
}
function snappedLayerPosition(l,x,y,density=cardBounds().density,bypass=false) {
  if(l.mode==='led'&&l.snapToGrid!==false&&!bypass) {
    const step=density*.5;return {x:Math.round(x/step)*step,y:Math.round(y/step)*step};
  }
  return {x:Math.round(x),y:Math.round(y)};
}
function setEditor(next) {
  editor=next;
  studioEl('panel').hidden=next==='layers';studioEl('layerPanel').hidden=next!=='layers';
  for(const [id,key] of [['editScreens','screens'],['editLayers','layers']]) {
    studioEl(id).classList.toggle('active',key===next);studioEl(id).setAttribute('aria-pressed',String(key===next));
  }
  document.querySelector('.workspace').classList.toggle('layer-active',next==='layers');
  renderLayerPanel();redraw();
}
function addMask() {
  const l={id:uid(),mode:appMode,type:'mask',name:'Overlap mask',x:0,y:0,width:256,height:256,unit:'px',opacity:100,visible:true,fillOpacity:20,snapToGrid:true,spacing:128,lineWidth:3,color:'#ed1c24'};
  overlays.push(l);selectedLayer=l.id;setEditor('layers');
}
async function readImageFile(file) {
  if(!file || !/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) throw new Error('Choose a PNG, JPG, WebP, GIF, or SVG image.');
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Unable to read this image.'));r.readAsDataURL(file);});
  const img=await decodeImage(data);
  return {data,img};
}
function decodeImage(data) {
  const cached=(data===defaultLogoDataURL?defaultLogoImg:null)||logoImages.get(data);
  if(cached)return Promise.resolve(cached);
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{logoImages.set(data,img);resolve(img);};img.onerror=()=>reject(new Error('This image could not be opened.'));img.src=data;});
}
async function uploadOverlay(file) {
  const mode=appMode;
  try {
    const {data,img}=await readImageFile(file);
    const id=uid(),assetId='image-'+crypto.randomUUID();layerAssets.set(assetId,{data,img});
    overlays.push({id,assetId,mode,type:'image',name:file.name,x:0,y:0,width:img.naturalWidth,height:img.naturalHeight,unit:'px',opacity:100,visible:true,snapToGrid:true});
    selectedLayer=id;setEditor('layers');showToast('Image added as a layer');
  } catch(error) { showToast(error.message); }
}
function selectLayer(id) {selectedLayer=id;renderLayerPanel();redraw();}
function layerValue(key,value) {
  const l=activeLayer();if(!l)return;
  if(key==='name') l.name=value.slice(0,200);
  else if(key==='color') l.color=value;
  else if(key==='snapToGrid') l.snapToGrid=Boolean(value);
  else {
    const n=Number(value);if(!Number.isFinite(n))return;
    if(['width','height','spacing','lineWidth'].includes(key)&&n<=0)return;
    if(key==='spacing'&&n<1)return;
    l[key]=key==='hatchCount'?Math.min(2000,Math.max(0,Math.round(n))):['opacity','fillOpacity'].includes(key)?Math.min(100,Math.max(0,n)):n;
  }
  redraw();
  if(l.type==='mask'){const countInput=studioEl('layer-hatchCount');if(countInput)countInput.value=hatchLineCount(l);}
  const op=studioEl(key+'Value');if(op)op.textContent=l[key]+'%';
  const info=studioEl('layerPixelSize');if(info){const p=layerPixels(l);info.textContent=`${formatLayerNumber(p.width)} × ${formatLayerNumber(p.height)} px in export`;}
}
function formatLayerNumber(n) {return Number(n.toFixed(3)).toLocaleString('en-US',{maximumFractionDigits:3});}
function layerUnit(unit) {
  const l=activeLayer();if(!l)return;
  const p=layerPixels(l),d=cardBounds().density;
  const f=unit==='cm'?d/100:unit==='m'?d:1;
  l.width=p.width/f;l.height=p.height/f;l.unit=unit;renderLayerPanel();redraw();
}
function toggleLayer(id) {const l=overlays.find(l=>l.id===id);l.visible=!l.visible;renderLayerPanel();redraw();}
function deleteLayer() {overlays=overlays.filter(l=>l.id!==selectedLayer);selectedLayer=null;renderLayerPanel();redraw();}
function reorderLayer(direction) {
  const group=modeLayers(),i=group.findIndex(l=>l.id===selectedLayer),other=group[i+direction];if(!other)return;
  const a=overlays.indexOf(group[i]),b=overlays.indexOf(other);[overlays[a],overlays[b]]=[overlays[b],overlays[a]];renderLayerPanel();redraw();
}
function fitLayerWidth() {const l=activeLayer();if(!l)return;const p=layerPixels(l),w=cardBounds().width;l.height*=w/p.width;l.width*=w/p.width;l.x=0;renderLayerPanel();redraw();}
function bottomLayer() {const l=activeLayer();if(!l)return;l.y=cardBounds().height-layerPixels(l).height;renderLayerPanel();redraw();}
function renderLayerPanel() {
  const group=modeLayers(),l=activeLayer();studioEl('layerCount').textContent=group.length;
  const list=[...group].reverse().map(item=>`<div class="layer-item ${item.id===selectedLayer?'selected':''}">${item.type==='image'?`<img class="layer-swatch image" src="${layerAssets.get(item.assetId||item.id)?.data||''}" alt="">`:'<span class="layer-swatch" aria-hidden="true"></span>'}<button class="select-layer" onclick="selectLayer('${item.id}')">${esc(item.name)}<small>${item.type==='mask'?'Hatched mask':'Image'} · ${item.opacity}%</small></button><button class="visibility" onclick="toggleLayer('${item.id}')" aria-label="${item.visible?'Hide':'Show'} ${esc(item.name)}">${item.visible?'Hide':'Show'}</button></div>`).join('');
  let html=`<section class="control-card"><div class="section-title">Overlay layers</div><button class="btn btn-s layer-upload" onclick="studioEl('overlayFile').click()">Upload image ↑</button><button class="btn btn-p layer-upload" onclick="addMask()">+ Red hatch mask</button><input id="overlayFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onchange="uploadOverlay(this.files[0]);this.value=''">${group.length?`<div class="layer-list">${list}</div>`:'<div class="empty-layers">Add an image or mask over your test card.</div>'}<p class="muted-note">Layers move across the entire layout. The top layer in this list appears on top of the export.</p></section>`;
  if(l) {
    const p=layerPixels(l);
    const field=(label,key,value,step='any')=>`<div class="form-group"><label for="layer-${key}">${label}</label><input id="layer-${key}" type="number" step="${step}" ${key==='hatchCount'?'min="0" max="2000"':['width','height','spacing','lineWidth'].includes(key)?'min="0.001"':''} value="${Number(value.toFixed(4))}" oninput="layerValue('${key}',this.value)" onchange="renderLayerPanel()"></div>`;
    html+=`<section class="control-card"><div class="section-title">${l.type==='mask'?'Mask':'Image'} settings</div><div class="form-group"><label for="layer-name">Layer name</label><input id="layer-name" value="${esc(l.name)}" oninput="layerValue('name',this.value)" onchange="renderLayerPanel()"></div><div class="form-row">${field('X position (px)','x',l.x)}${field('Y position (px)','y',l.y)}</div><div class="form-group"><label for="layer-unit">Size unit</label><select id="layer-unit" onchange="layerUnit(this.value)"><option value="px" ${l.unit==='px'?'selected':''}>Pixels (px)</option>${appMode==='led'?`<option value="cm" ${l.unit==='cm'?'selected':''}>Centimetres (cm)</option><option value="m" ${l.unit==='m'?'selected':''}>Metres (m)</option>`:''}</select></div><div class="form-row">${field('Width ('+l.unit+')','width',l.width)}${field('Height ('+l.unit+')','height',l.height)}</div><div class="muted-note" id="layerPixelSize">${formatLayerNumber(p.width)} × ${formatLayerNumber(p.height)} px in export</div><div class="layer-actions"><button onclick="fitLayerWidth()">Fit card width</button><button onclick="bottomLayer()">Align bottom</button></div><div class="form-group"><label for="layer-opacity">Layer opacity <span class="opacity-value" id="opacityValue">${l.opacity}%</span></label><input id="layer-opacity" type="range" min="0" max="100" value="${l.opacity}" oninput="layerValue('opacity',this.value)"></div>`;
    html+=`${appMode==='led'?`<div class="cb"><input id="layer-snapToGrid" type="checkbox" ${l.snapToGrid!==false?'checked':''} onchange="layerValue('snapToGrid',this.checked)"><label for="layer-snapToGrid">Snap movement to 0.5 m</label></div><p class="muted-note">Hold Shift while dragging to move freely. Enter exact positions above when needed.</p>`:''}`;
    if(l.type==='mask')html+=`<div class="form-group"><label for="layer-fillOpacity">Red fill <span class="opacity-value" id="fillOpacityValue">${l.fillOpacity}%</span></label><input id="layer-fillOpacity" type="range" min="0" max="100" value="${l.fillOpacity}" oninput="layerValue('fillOpacity',this.value)"></div><div class="form-row">${field('Number of hatch lines','hatchCount',hatchLineCount(l),'1')}${field('Stroke width (px)','lineWidth',l.lineWidth)}</div>`;
    const i=group.indexOf(l);
    html+=`<div class="layer-actions"><button onclick="reorderLayer(1)" ${i===group.length-1?'disabled':''}>Move up</button><button onclick="reorderLayer(-1)" ${i===0?'disabled':''}>Move down</button><button class="delete-layer" onclick="deleteLayer()">Delete layer</button></div><p class="muted-note">Drag the selected layer in the preview, or enter its position above. Anything outside the test card is clipped in the export.${appMode==='custom'?' Physical units are available in LED wall mode.':''}</p></section>`;
  }
  studioEl('layerPanel').innerHTML=html;
}
function renderOverlays(target,minX,minY,density,preview=false) {
  const b=cardBounds(), ratio=density/b.density;
  target.save();
  // Clip preview to the same screen-based rectangle used by PNG and SVG.
  target.beginPath();target.rect((b.minX-minX)*density,(b.minY-minY)*density,b.width*ratio,b.height*ratio);target.clip();
  for(const l of modeLayers()) {
    if(!l.visible||l.opacity===0)continue;
    const p=layerPixels(l,b.density),x=(b.minX-minX)*density+p.x*ratio,y=(b.minY-minY)*density+p.y*ratio,w=p.width*ratio,h=p.height*ratio;
    target.save();target.globalAlpha=l.opacity/100;
    if(l.type==='image') {const img=layerAssets.get(l.assetId||l.id)?.img;if(img)target.drawImage(img,x,y,w,h);}
    else {
      target.save();target.globalAlpha*=l.fillOpacity/100;target.fillStyle=l.color;target.fillRect(x,y,w,h);target.restore();
      const count=hatchLineCount(l,b.density),spacing=hatchSpacing(l,b.density)*ratio,lw=l.lineWidth*ratio;
      target.save();target.beginPath();target.rect(x,y,w,h);target.clip();target.strokeStyle=l.color;target.lineWidth=lw;
      const clipLeft=Math.max(x,(b.minX-minX)*density),clipTop=Math.max(y,(b.minY-minY)*density),clipRight=Math.min(x+w,(b.minX-minX)*density+b.width*ratio),clipBottom=Math.min(y+h,(b.minY-minY)*density+b.height*ratio);
      target.beginPath();if(count>0&&clipRight>clipLeft&&clipBottom>clipTop){const first=Math.max(1,Math.floor((clipLeft-x+clipTop-y)/spacing)),last=Math.min(count,Math.ceil((clipRight-x+clipBottom-y)/spacing));for(let i=first;i<=last;i++){const offset=-h+i*spacing;target.moveTo(x+offset,y+h);target.lineTo(x+offset+h,y);}}target.stroke();target.restore();
      target.strokeStyle=l.color;target.lineWidth=Math.min(lw,w,h);const inset=target.lineWidth/2;target.strokeRect(x+inset,y+inset,Math.max(0,w-2*inset),Math.max(0,h-2*inset));
    }
    target.restore();
  }
  target.restore();
}
function overlaySVG(minX,minY,density) {
  const b=cardBounds(),ratio=density/b.density;
  return modeLayers().filter(l=>l.visible&&l.opacity>0).map(l=>{
    const p=layerPixels(l,b.density),x=(b.minX-minX)*density+p.x*ratio,y=(b.minY-minY)*density+p.y*ratio,w=p.width*ratio,h=p.height*ratio;
    if(l.type==='image')return `<image x="${x}" y="${y}" width="${w}" height="${h}" opacity="${l.opacity/100}" preserveAspectRatio="none" href="${layerAssets.get(l.assetId||l.id)?.data||''}"/>`;
    const count=hatchLineCount(l,b.density),sp=hatchSpacing(l,b.density)*ratio,lw=l.lineWidth*ratio,border=Math.min(lw,w,h),inset=border/2;
    const pattern=count>0?`<defs><pattern id="hatch-${l.id}" width="${sp}" height="${sp}" patternUnits="userSpaceOnUse" patternTransform="translate(${x} ${y})"><path d="M ${-sp} ${sp} L ${sp} ${-sp} M 0 ${sp} L ${sp} 0 M ${sp} ${sp} L ${2*sp} 0" fill="none" stroke="${l.color}" stroke-width="${lw}"/></pattern></defs>`:'';
    const hatch=count>0?`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#hatch-${l.id})" opacity="${l.opacity/100}"/>`:'';
    return `${pattern}<g data-layer-opacity="${l.opacity/100}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${l.color}" fill-opacity="${l.fillOpacity*l.opacity/10000}"/>${hatch}<rect x="${x+inset}" y="${y+inset}" width="${Math.max(0,w-border)}" height="${Math.max(0,h-border)}" fill="none" stroke="${l.color}" stroke-width="${border}" stroke-opacity="${l.opacity/100}"/></g>`;
  }).join('');
}
function drawOverlayPreview() {
  renderOverlays(ctx,-panX/(PPM*zoom),-panY/(PPM*zoom),PPM*zoom,true);
  const l=activeLayer(),hl=studioEl('layerHL');hl.hidden=editor!=='layers'||!l||!l.visible;
  if(!hl.hidden) {const b=cardBounds(),p=layerPixels(l),r=PPM*zoom/b.density;hl.style.left=(b.minX*PPM*zoom+panX+p.x*r)+'px';hl.style.top=(b.minY*PPM*zoom+panY+p.y*r)+'px';hl.style.width=p.width*r+'px';hl.style.height=p.height*r+'px';}
}
const baseDrawLED=drawAll,baseDrawCustom=drawCustomAll,baseSetMode=setMode;
drawAll=function(){baseDrawLED();drawOverlayPreview();};
drawCustomAll=function(){baseDrawCustom();drawOverlayPreview();};
setMode=function(mode){baseSetMode(mode);selectedLayer=null;renderLayerPanel();zoomFit();};
let layerDrag=null;
canvas.addEventListener('pointerdown',event=>{
  if(editor!=='layers'||event.button!==0)return;
  event.preventDefault();event.stopImmediatePropagation();
  const rect=canvas.getBoundingClientRect(),world=canvasToM(event.clientX-rect.left,event.clientY-rect.top),b=cardBounds();
  const x=(world.x-b.minX)*b.density,y=(world.y-b.minY)*b.density;
  const found=[...modeLayers()].reverse().find(l=>{const p=layerPixels(l);return l.visible&&l.opacity>0&&x>=p.x&&x<=p.x+p.width&&y>=p.y&&y<=p.y+p.height;});
  selectedLayer=found?.id||null;
  layerDrag=found?{id:found.id,dx:x-found.x,dy:y-found.y}:{pan:true,x:event.clientX,y:event.clientY,panX,panY};
  canvas.setPointerCapture(event.pointerId);renderLayerPanel();redraw();
},true);
canvas.addEventListener('mousedown',event=>{if(editor==='layers'&&event.button===0){event.preventDefault();event.stopImmediatePropagation();}},true);
canvas.addEventListener('pointermove',event=>{
  if(!layerDrag)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(layerDrag.pan){panX=layerDrag.panX+event.clientX-layerDrag.x;panY=layerDrag.panY+event.clientY-layerDrag.y;}
  else {const l=overlays.find(l=>l.id===layerDrag.id),rect=canvas.getBoundingClientRect(),world=canvasToM(event.clientX-rect.left,event.clientY-rect.top),b=cardBounds();const position=snappedLayerPosition(l,(world.x-b.minX)*b.density-layerDrag.dx,(world.y-b.minY)*b.density-layerDrag.dy,b.density,event.shiftKey);l.x=position.x;l.y=position.y;}
  redraw();
},true);
function finishLayerDrag(event){if(!layerDrag)return;layerDrag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);renderLayerPanel();}
canvas.addEventListener('pointerup',finishLayerDrag,true);canvas.addEventListener('pointercancel',finishLayerDrag,true);
resizeCanvas();renderPanel();autoLayout('horizontal');renderLayerPanel();zoomFit();
document.fonts.ready.then(()=>{resizeCanvas();zoomFit();});
window.addEventListener('resize',()=>{resizeCanvas();zoomFit();});

// Document history stores editable data, while decoded images remain shared assets.
const logoImages=new Map(),historyImageKeys=new Map();
let history=[],historyIndex=-1,restoringHistory=false;
const HISTORY_LIMIT=80;
function plainScreen(s) {
  const copy={...s};delete copy.logoImg;
  if(s.logoFileName==='Default Logo'&&(!s.logoImg||s.logoImg===defaultLogoImg))copy.logoDataURL='@default';
  else if(s.logoImg&&s.logoDataURL)logoImages.set(s.logoDataURL,s.logoImg);
  return copy;
}
function captureState() {
  return {appMode,pixelMapName,screens:screens.map(plainScreen),customScreens:customScreens.map(plainScreen),activeIdx,customActiveIdx,layoutMode,cLayoutMode,snapEnabled,overlays:overlays.map(l=>({...l})),selectedLayer,editor};
}
function stateSignature(state) {
  const {appMode,activeIdx,customActiveIdx,selectedLayer,editor,snapEnabled,...documentState}=state;
  return JSON.stringify(documentState,(key,value)=>{
    if(key==='logoDataURL'&&typeof value==='string'&&value.startsWith('data:')){if(!historyImageKeys.has(value))historyImageKeys.set(value,'logo-'+historyImageKeys.size);return historyImageKeys.get(value);}
    return value;
  });
}
function updateHistoryButtons() {
  const undo=studioEl('undoButton'),redo=studioEl('redoButton');
  if(undo)undo.disabled=historyIndex<=0;if(redo)redo.disabled=historyIndex>=history.length-1;
}
function commitHistory() {
  if(restoringHistory)return;
  const current=captureState();
  if(historyIndex>=0&&stateSignature(history[historyIndex])===stateSignature(current)) {
    history[historyIndex]=current;return;
  }
  history=history.slice(0,historyIndex+1);history.push(current);
  if(history.length>HISTORY_LIMIT)history.shift();historyIndex=history.length-1;updateHistoryButtons();
}
function hydrateScreen(s) {
  const copy={...s};
  if(s.logoDataURL==='@default'){copy.logoDataURL=defaultLogoDataURL||DEFAULT_LOGO_URL;copy.logoImg=defaultLogoImg;}
  else copy.logoImg=s.logoDataURL?logoImages.get(s.logoDataURL)||null:null;
  return copy;
}
function restoreState(state) {
  restoringHistory=true;
  try {
    appMode=state.appMode;pixelMapName=state.pixelMapName;
    screens=state.screens.map(hydrateScreen);customScreens=state.customScreens.map(hydrateScreen);
    activeIdx=Math.min(state.activeIdx,screens.length-1);customActiveIdx=Math.min(state.customActiveIdx,customScreens.length-1);
    layoutMode=state.layoutMode;cLayoutMode=state.cLayoutMode;snapEnabled=state.snapEnabled;
    overlays=state.overlays.map(l=>({...l}));selectedLayer=state.selectedLayer;
    // Close transient color pickers before replacing controls.
    closePicker();baseSetMode(appMode);
    document.querySelectorAll('#ledLayoutSelect [data-layout]').forEach(b=>b.classList.toggle('active',b.dataset.layout===layoutMode));
    document.querySelectorAll('#customLayoutSelect [data-clayout]').forEach(b=>b.classList.toggle('active',b.dataset.clayout===cLayoutMode));
    setEditor(state.editor);zoomFit();updateHistoryButtons();
  } finally {restoringHistory=false;}
}
function undoDocument() {commitHistory();if(historyIndex<=0)return;historyIndex--;restoreState(history[historyIndex]);showToast('Undo');}
function redoDocument() {if(historyIndex>=history.length-1)return;historyIndex++;restoreState(history[historyIndex]);showToast('Redo');}
const historyToolbar=document.createElement('div');historyToolbar.className='history-toolbar';historyToolbar.innerHTML='<button id="undoButton" onclick="undoDocument()" title="Undo (Ctrl / ⌘ Z)" disabled>↶ Undo</button><button id="redoButton" onclick="redoDocument()" title="Redo (Ctrl / ⌘ Shift Z)" disabled>Redo ↷</button>';
document.querySelector('.header').insertBefore(historyToolbar,studioEl('sysStatus'));
commitHistory();
const isHistoryControl=e=>e.target.closest?.('#undoButton,#redoButton');
// Capture edits after their own handlers. Ranges and drags become one action.
document.addEventListener('focusin',()=>commitHistory(),true);
document.addEventListener('focusout',()=>queueMicrotask(commitHistory));
document.addEventListener('change',()=>queueMicrotask(commitHistory));
document.addEventListener('click',event=>{if(isHistoryControl(event))return;commitHistory();queueMicrotask(commitHistory);},true);
document.addEventListener('pointerdown',event=>{if(!isHistoryControl(event))commitHistory();},true);
document.addEventListener('pointerup',()=>queueMicrotask(commitHistory),true);
document.addEventListener('mouseup',()=>queueMicrotask(commitHistory),true);
document.addEventListener('input',event=>{if(!event.target.isConnected)queueMicrotask(commitHistory);});
document.addEventListener('keydown',event=>{
  if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
  if(event.target.closest?.('input,textarea,[contenteditable="true"]'))return;
  if(event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redoDocument():undoDocument();}
  else if(event.key.toLowerCase()==='y'){event.preventDefault();redoDocument();}
});
const layerUploadWithoutHistory=uploadOverlay;
uploadOverlay=async function(file){commitHistory();await layerUploadWithoutHistory(file);commitHistory();};

// Versioned, self-contained test-card document. Image bytes live in an asset table.
const PROJECT_FORMAT='andrei-test-card';
const PROJECT_VERSION=1;
let projectBusy=false;
function projectImage(data) {
  if(typeof data!=='string'||data.length>128*1024*1024||!/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/.test(data))throw new Error('The project contains an invalid image asset.');
  return data;
}
async function embeddedDefaultLogo() {
  if(defaultLogoDataURL)return defaultLogoDataURL;
  const img=await decodeImage(DEFAULT_LOGO_URL),c=document.createElement('canvas');
  c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);
  return c.toDataURL('image/png');
}
async function buildProject() {
  const state=captureState(),assets={},byData=new Map();
  const needsDefault=[...state.screens,...state.customScreens].some(s=>s.logoDataURL==='@default');
  const defaultData=needsDefault?await embeddedDefaultLogo():null;
  function addAsset(data) {
    if(!data)return null;if(byData.has(data))return byData.get(data);
    const key='asset-'+(byData.size+1);assets[key]={data:projectImage(data)};byData.set(data,key);return key;
  }
  const packScreen=s=>{const copy={...s};copy.logoAsset=addAsset(s.logoDataURL==='@default'?defaultData:s.logoDataURL);delete copy.logoDataURL;return copy;};
  state.screens=state.screens.map(packScreen);state.customScreens=state.customScreens.map(packScreen);
  state.overlays=state.overlays.map(l=>{const copy={...l};if(l.type==='image'){copy.asset=addAsset(layerAssets.get(l.assetId||l.id)?.data);delete copy.assetId;}return copy;});
  return {format:PROJECT_FORMAT,version:PROJECT_VERSION,application:'Pixel Map Studio',savedAt:new Date().toISOString(),document:state,assets};
}
function downloadStudioFile(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function saveProject() {
  if(projectBusy)return;projectBusy=true;
  try {commitHistory();const project=await buildProject();downloadStudioFile(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),(pixelMapName||'Test_Card').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.tcmap');showToast('Editable project saved (.tcmap)');}
  catch(error){showToast(error.message);}finally{projectBusy=false;}
}
function checkedNumber(value,label,min,max,integer=false) {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw new Error('Invalid '+label+' in project.');
  return value;
}
function checkedText(value,label,max=1000) {if(typeof value!=='string'||value.length>max)throw new Error('Invalid '+label+' in project.');return value;}
function checkedChoice(value,choices,label) {if(!choices.includes(value))throw new Error('Invalid '+label+' in project.');return value;}
function checkedColor(value) {if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error('Invalid color in project.');return value;}
function checkedBool(value,label) {if(typeof value!=='boolean')throw new Error('Invalid '+label+' in project.');return value;}
function validateProject(project) {
  if(!project||typeof project!=='object'||project.format!==PROJECT_FORMAT)throw new Error('Choose a Pixel Map Studio .tcmap project.');
  if(project.version!==PROJECT_VERSION)throw new Error('This project version is not supported.');
  const source=project.document,rawAssets=project.assets;
  if(!source||!rawAssets||typeof rawAssets!=='object'||Array.isArray(rawAssets))throw new Error('The project is incomplete.');
  const assets={};let totalBytes=0;
  if(Object.keys(rawAssets).length>300)throw new Error('The project has too many image assets.');
  for(const [key,asset] of Object.entries(rawAssets)) {
    if(!/^asset-[1-9][0-9]*$/.test(key))throw new Error('Invalid asset identifier in project.');
    const data=projectImage(asset?.data);totalBytes+=data.length;
    if(totalBytes>128*1024*1024)throw new Error('The project images exceed 128 MB.');assets[key]={data};
  }
  function assetRef(value,required=false) {
    if(value===null&&!required)return null;
    if(typeof value!=='string'||!Object.hasOwn(assets,value))throw new Error('The project is missing an image.');return value;
  }
  function screenList(list,custom) {
    if(!Array.isArray(list)||list.length<1||list.length>100)throw new Error('Invalid screen list in project.');
    return list.map((raw,i)=>{
      if(!raw||typeof raw!=='object')throw new Error('Invalid screen in project.');
      const defaults=custom?mkCustomScreen(i):mkScreen(i),out={};
      for(const [key,fallback] of Object.entries(defaults)) {
        if(key==='logoImg'||key==='logoDataURL')continue;
        const value=Object.hasOwn(raw,key)?raw[key]:fallback;
        if(key.endsWith('Color'))out[key]=checkedColor(value);
        else if(typeof fallback==='boolean')out[key]=checkedBool(value,key);
        else if(typeof fallback==='number') {
          let min=-1e7,max=1e7,integer=false;
          if(['widthM','heightM','cabinetSize'].includes(key)){min=.0001;max=10000;}
          if(['resW','resH','pitchRes'].includes(key)){min=1;max=65536;integer=true;}
          if(key.endsWith('Opacity')){min=0;max=100;}
          if(key==='gridDensity'){min=1;max=2048;integer=true;}
          if(key==='borderWidth'){min=0;max=1000;}
          if(key==='logoScale'){min=1;max=100;}
          if(key==='logoX'||key==='logoY'){min=0;max=100;}
          if(key==='id'){min=0;max=Number.MAX_SAFE_INTEGER;}
          out[key]=checkedNumber(value,key,min,max,integer);
        } else out[key]=checkedText(value,key);
      }
      out.labelMode=checkedChoice(out.labelMode,['auto','custom','none'],'label mode');
      out.brandMode=checkedChoice(out.brandMode,['logo','text','both','none'],'branding');
      out.logoAsset=assetRef(raw.logoAsset??null);
      return out;
    });
  }
  const state={
    appMode:checkedChoice(source.appMode,['led','custom'],'map type'),pixelMapName:checkedText(source.pixelMapName,'project name'),
    screens:screenList(source.screens,false),customScreens:screenList(source.customScreens,true),
    layoutMode:checkedChoice(source.layoutMode,['horizontal','vertical','grid','free'],'LED layout'),cLayoutMode:checkedChoice(source.cLayoutMode,['auto','free'],'custom layout'),
    snapEnabled:checkedBool(source.snapEnabled,'snap setting'),editor:checkedChoice(source.editor,['screens','layers'],'editing tool'),
    activeIdx:0,customActiveIdx:0,selectedLayer:null,overlays:[]
  };
  state.activeIdx=checkedNumber(source.activeIdx,'selected screen',0,state.screens.length-1,true);
  state.customActiveIdx=checkedNumber(source.customActiveIdx,'selected custom screen',0,state.customScreens.length-1,true);
  if(!Array.isArray(source.overlays)||source.overlays.length>200)throw new Error('Invalid layer list in project.');
  const ids=new Set();
  state.overlays=source.overlays.map(raw=>{
    if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||!/^layer-[A-Za-z0-9_-]{1,90}$/.test(raw.id)||ids.has(raw.id))throw new Error('Invalid layer identifier in project.');
    ids.add(raw.id);
    const l={id:raw.id,mode:checkedChoice(raw.mode,['led','custom'],'layer mode'),type:checkedChoice(raw.type,['image','mask'],'layer type'),name:checkedText(raw.name,'layer name',200),unit:checkedChoice(raw.unit,['px','cm','m'],'size unit'),visible:checkedBool(raw.visible,'layer visibility')};
    if(l.mode==='custom'&&l.unit!=='px')throw new Error('Custom-resolution layers use pixels.');
    for(const k of ['x','y'])l[k]=checkedNumber(raw[k],k,-1e7,1e7);
    for(const k of ['width','height'])l[k]=checkedNumber(raw[k],k,.000001,1e7);
    l.opacity=checkedNumber(raw.opacity,'opacity',0,100);
    l.snapToGrid=Object.hasOwn(raw,'snapToGrid')?checkedBool(raw.snapToGrid,'layer grid snap'):true;
    if(l.type==='mask'){l.color=checkedColor(raw.color);l.fillOpacity=checkedNumber(raw.fillOpacity,'fill opacity',0,100);l.spacing=checkedNumber(raw.spacing,'hatch spacing',1,100000);l.lineWidth=checkedNumber(raw.lineWidth,'stroke width',.001,100000);if(Object.hasOwn(raw,'hatchCount'))l.hatchCount=checkedNumber(raw.hatchCount,'hatch line count',0,2000,true);}
    else l.asset=assetRef(raw.asset,true);
    return l;
  });
  if(source.selectedLayer!==null){if(!ids.has(source.selectedLayer))throw new Error('Invalid selected layer in project.');state.selectedLayer=source.selectedLayer;}
  return {state,assets};
}
async function openProjectFile(file) {
  if(!file||projectBusy)return;projectBusy=true;
  try {
    if(file.size>128*1024*1024)throw new Error('The project file exceeds 128 MB.');
    let parsed;try{parsed=JSON.parse(await file.text());}catch{throw new Error('This file is not a readable .tcmap project.');}
    const {state,assets}=validateProject(parsed);
    // Decode everything before changing the current document, so a bad file is harmless.
    const decoded=new Map(await Promise.all(Object.entries(assets).map(async([id,a])=>[id,{data:a.data,img:await decodeImage(a.data)}])));
    const unpackScreen=s=>{const copy={...s},asset=s.logoAsset?decoded.get(s.logoAsset):null;delete copy.logoAsset;copy.logoDataURL=asset?.data||null;if(asset)logoImages.set(asset.data,asset.img);return copy;};
    state.screens=state.screens.map(unpackScreen);state.customScreens=state.customScreens.map(unpackScreen);
    const imageKeys=new Map();
    state.overlays=state.overlays.map(l=>{const copy={...l};if(l.asset){const a=decoded.get(l.asset);if(!imageKeys.has(l.asset))imageKeys.set(l.asset,'image-'+crypto.randomUUID());copy.assetId=imageKeys.get(l.asset);layerAssets.set(copy.assetId,a);delete copy.asset;}return copy;});
    commitHistory();restoreState(state);commitHistory();showToast('Project opened — ready to edit');
  } catch(error){showToast(error.message);}finally{projectBusy=false;}
}
const projectToolbar=document.createElement('div');projectToolbar.className='project-toolbar';projectToolbar.innerHTML='<button onclick="studioEl(\'projectFile\').click()">Open project ↑</button><button onclick="saveProject()">Save project ↓</button><input id="projectFile" type="file" accept=".tcmap,application/json" hidden onchange="openProjectFile(this.files[0]);this.value=\'\'">';
document.querySelector('.header').insertBefore(projectToolbar,studioEl('sysStatus'));
