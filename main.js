import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from './OrbitControls.js';
import { GUI } from 'lil-gui';

const canvas = document.querySelector( '#visptu' );
const renderer = new THREE.WebGLRenderer( { antialias: true, canvas } );
let scene = new THREE.Scene(), camera, gui;
const dataEntryTA = document.getElementById('dataEntryTA');

// ======================== HTML ========================
const updateVisBtn = document.getElementById('updateVis');
const clearBtn = document.getElementById('clear');
const copyRAPDBtn = document.getElementById('copyRAPD');

clearBtn.onclick = function(){
  panoElemArray = [];
  dataEntryTA.value = "";
};

copyRAPDBtn.onclick = function(){
	var copyText = dataEntryTA.value; // start with raw
	// read and reformat the panoplan if able
	let ppArray = dataEntryTA.value.split("\n"); 
	if(ppArray.length > 1) {
		copyText = "";
		for(let i = 0; i < ppArray.length; i++){
			if(ppArray[i].length > 1){
				// comes in following format, so need to split
				// id: p(2dp), t(2dp)	[cams:lrhen]
				let ppASplit = ppArray[i].match(/(?<id>\d+): (?<pan>-?\d+.\d+), (?<tilt>-?\d+.\d+)(\s\[(?<cams>\w+)\])?/)
				if(ppASplit != null){
					copyText += `MAST_PTU_MoveTo(${ppASplit.groups.pan},${ppASplit.groups.tilt});\n`
				}
			}
		}
		// Copy the text inside the text field
		navigator.clipboard.writeText(copyText);

		// Alert the copied text
		alert("Copied to clipboard: \n\n" + copyText);
	}
	alert("Nothing to copy!");
};

updateVisBtn.onclick = function(){
	let ppArray = dataEntryTA.value.split("\n"); // read the panoplan in the textarea
	if(ppArray.length > 1) {
		for(let i = 0; i < ppArray.length; i++){
			if(ppArray[i].length > 1){
				// comes in following format, so need to split
				// id: p(2dp), t(2dp)	[cams:lrhen]
				let ppASplit = ppArray[i].match(/(?<id>\d+): (?<pan>-?\d+.\d+), (?<tilt>-?\d+.\d+)(\s\[(?<cams>\w+)\])?/)
				if(ppASplit != null){
					// try to drop out based on the easiest stuff first
					if((ppASplit.groups.id != panoElemArray[i].id) || (ppASplit.groups.pan != panoElemArray[i].pan) || (ppASplit.groups.tilt != panoElemArray[i].tilt)) {
						clearAndRedrawPano(ppArray);
					} else {
						// only do this if cams are defined; also guards against empty [] edits
						if(ppASplit.groups.cams != undefined){
							let ppACams = camsShort2Long(ppASplit.groups.cams.split(""))
							if(ppACams.sort().toString() != panoElemArray[i].cams.sort().toString()) clearAndRedrawPano(ppArray);
						}
					}						
				}
			}
		}
	}
};

function camsShort2Long(camsList){
	let longList = [];
	if(camsList.includes("l")) longList.push("lwac");
	if(camsList.includes("r")) longList.push("rwac");
	if(camsList.includes("h")) longList.push("hrc");
	if(camsList.includes("e")) longList.push("enfys");
	if(camsList.includes("n")) longList.push("nav");
	return longList
};
function camsLong2Short(camsList){
	let shortList = [];
	if(camsList.includes("lwac")) shortList.push("l");
	if(camsList.includes("rwac")) shortList.push("r");
	if(camsList.includes("hrc")) shortList.push("h");
	if(camsList.includes("enfys")) shortList.push("e");
	if(camsList.includes("nav")) shortList.push("n");
	return shortList
};

function formatPanoPlanText(peArray){
	let dataToDisplay = "";
	peArray.forEach((pe) => dataToDisplay += panoElemMakeString(pe));
	dataEntryTA.value = dataToDisplay;
};

// ======================== pano elements ========================
let panoElements = new THREE.Object3D()
panoElements.name = "panoElements";
let panoElemArray = [];

function addElem(pan, tilt, cams){
	panoElemArray.push(new PanoElem((panoElemArray.length+1), pan, tilt, cams));
};

// class to store info
class PanoElem {
	constructor(id = 0, pan = 0.0, tilt = 0.0, cams = []) {
		this.id = id;
		this.pan = pan;
		this.tilt = tilt;
		this.cams = cams;
	};
};

function panoElemMakeString(panoElem){
	if(panoElem.length == 0) return "";
	let id = Number(panoElem.id);
	let pan = Number(panoElem.pan).toFixed(2);
	let tilt = Number(panoElem.tilt).toFixed(2);
	let c = (panoElem.cams.length > 0) ? `\t[${panoElem.cams.includes("lwac")?"l":""}${panoElem.cams.includes("rwac")?"r":""}${panoElem.cams.includes("hrc")?"h":""}${panoElem.cams.includes("enfys")?"e":""}${panoElem.cams.includes("nav")?"n":""}]` : "";
	return `${id}: ${pan}, ${tilt}${c}\n`;
};

// draw in the scene
function addPanoImg(position, direction, group, camID){
	// get far vector and setup for correct camera
	let facingPos = new THREE.Vector3();
	let farVec = lwac.far;
	let imgSize = new THREE.Vector2();

	// materials: red = lwac, green = rwac, blue = hrc
	let material = new THREE.MeshBasicMaterial( {color: 0x886666, side: THREE.DoubleSide, transparent: true, opacity: 0.4} );
	
	if(camID == "lwac"){ 
		farVec = lwac.far;
		lwac.getViewSize(farVec, imgSize);
		lwac.getWorldPosition(facingPos);
	}
	else if(camID == "rwac"){ 
		farVec = rwac.far;
		rwac.getViewSize(farVec, imgSize);
		rwac.getWorldPosition(facingPos);
		material = new THREE.MeshBasicMaterial( {color: 0x668866, side: THREE.DoubleSide, transparent: true, opacity: 0.4} );
	}
	else if(camID == "hrc"){
		material = new THREE.MeshBasicMaterial( {color: 0x666688, side: THREE.DoubleSide, transparent: true, opacity: 0.4} );
		farVec = hrc.far; 
		hrc.getViewSize(farVec, imgSize);
		hrc.getWorldPosition(facingPos);
	}
	else if(camID == "enfys"){
		material = new THREE.MeshBasicMaterial( {color: 0x666666, side: THREE.DoubleSide, transparent: true, opacity: 0.4} );
		farVec = enfys.far; 
		enfys.getViewSize(farVec, imgSize);
		enfys.getWorldPosition(facingPos);
	}
	else if(camID == "nav"){
		material = new THREE.MeshBasicMaterial( {color: 0x888888, side: THREE.DoubleSide, transparent: true, opacity: 0.5} );
		farVec = lnav.far; 
		lnav.getViewSize(farVec, imgSize);
		lnav.getWorldPosition(facingPos);
	}

	// take a position and generate an element (pic) for the panorama
	const geometry = new THREE.PlaneGeometry( imgSize.x, imgSize.y );
	const image = new THREE.InstancedMesh( geometry, material, 1 );
    image.position.copy( position );
    image.position.addScaledVector( direction, farVec );
    image.lookAt( facingPos );
    image.name = "panoElement";
	group.add( image );
};

function panArrayGenerator(start, stop, numPics){
	let currPan = start, angleArray = [], step;
	angleArray.push(currPan);

	if(start == stop) return angleArray;
	else if((numPics - 2) > 0) step = (stop - start) / (numPics-1);
	else step = stop - start;

	for(let p = 0; p < numPics-1; p++) {
		angleArray.push(currPan + step);
		currPan += step;
	};
	return angleArray;
};

function displayPanoElem(cam, direction, position){
	if(cam == "lwac"){
		lwac.getWorldDirection( direction );
	    lwac.getWorldPosition( position );
	}
	if(cam == "rwac"){
		rwac.getWorldDirection( direction );
	    rwac.getWorldPosition( position );
	}
	if(cam == "hrc"){
		hrc.getWorldDirection( direction );
	    hrc.getWorldPosition( position );
	}
	if(cam == "enfys"){
		enfys.getWorldDirection( direction );
	    enfys.getWorldPosition( position );
	}
	if(cam == "nav"){
		lnav.getWorldDirection( direction );
	    lnav.getWorldPosition( position );
	}
	addPanoImg(position, direction, panoElements, cam);
};

function panoPlan(pans, numPics, useLwac, useRwac, useHrc, useEnfys, useNav){
	// prep all the details; cams is a bit verbose to link into the GUI
	let camsToUse = [];
	let camStr = "";
	if(useLwac) camStr += "l";
	if(useRwac) camStr += "r";
	if(useHrc) camStr += "h";
	if(useEnfys) camStr += "e";
	if(useNav) camStr += "n";

	let tilts = [];
	for(let p = 0; p < pans.length; p++){
		tilts.push(tiltAngle.value);
		camsToUse.push(camStr);
	};

	panoPlanFromPTU(pans, tilts, camsToUse);
};

function panoPlanFromPTU(pans, tilts, cams){
	let camDirection = new THREE.Vector3();
	let camPosition = new THREE.Vector3();
	let camSet = [];

	for(let i = 0; i < pans.length; i++) {
		setPan(pans[i]);
		setTilt(tilts[i]);
		camSet = (typeof cams[i] == "string") ? camsShort2Long(cams[i].split("")) : [];
		addElem(pans[i], tilts[i], camSet);
		
		for(let cam of camSet) {
			displayPanoElem(cam, camDirection, camPosition);
		};
	};

	// reset ptu to centre
    setPan(0);
    setTilt(0);
    scene.add(panoElements);
    formatPanoPlanText(panoElemArray);
};

function clearAndRedrawPano(newSpec){
	panoSpec.clearVisualisation();
	panoElemArray = [];
	let panList = [], tiltList = [], camsList = [];
	for(let i = 0; i < newSpec.length; i++){
		if(newSpec[i].length > 1){
			// id: p(2dp), t(2dp)	[cams:lrhen]
			let ppASplit = newSpec[i].match(/(?<id>\d+): (?<pan>-?\d+.\d+), (?<tilt>-?\d+.\d+)(\s\[(?<cams>\w+)\])?/)
			panList.push(ppASplit.groups.pan);
			tiltList.push(ppASplit.groups.tilt);
			camsList.push(ppASplit.groups.cams);
		}
	}
	panoPlanFromPTU(panList, tiltList, camsList);
};

// ======================== model control ========================
let lwac, rwac, hrc, enfys, lnav, rnav, navfar=2, lwacVis, rwacVis, hrcVis, enfysVis, lnavVis, rnavVis;
let lloc, rloc, llocVis, rlocVis;
let clupi, clupi_fov_1, clupi_fov_2, clupi_fov_3, clupiVis, clupif1Vis, clupif2Vis, clupif3Vis;
let tiltGroup, panGroup, drillgroup;
const drillGroupHeight = 0.44;
const drillGroupAngle = 0;

let clupiVisAll = {	
	visible: false, 
};

let navcams = {	
	visible: false, 
	viewFar: navfar,
};

let panoSpec = { 
	start: 0, 
	stop: 0, 
	numPics: 2,
	lwac: false,
	rwac: false,
	hrc: false,
	enfys: false,
	nav: false,
	panoPlan: function(){ 
		let panList = panArrayGenerator(this.start, this.stop, this.numPics);
		panoPlan(panList, this.numPics, this.lwac, this.rwac, this.hrc, this.enfys, this.nav); 
	},
	clearPanoPlan: function(){ 
		// collect all the pics and clear them, reset variables
		this.start = 0;
		this.stop = 0;
		this.numPics = 2;
		this.lwac = false;
		this.rwac = false;
		this.hrc = false;
		this.enfys = false;
		this.nav = false;
	},
	clearVisualisation: function(){ 
		if(scene.getObjectByName("panoElements")){
			panoElements.clear();
		}
	},
};

// panning and tilting from degrees
let panAngle = { value: 0 };
function setPan(angle){
	// take degrees and turn to rads
	panGroup.rotation.y = THREE.MathUtils.degToRad(angle);
	panAngle.value = angle;
};

let tiltAngle = { value: 0 };
function setTilt(angle){
	// take degrees and turn to rads, note that tilt is opposite direction
	tiltGroup.rotation.x = -1 * THREE.MathUtils.degToRad(angle);
	tiltAngle.value = angle;
};
// translation and rotation for drillbox
let drillAngle = { value: 0 };
function setDrillAngle(angle){
	// take degrees and turn to rads
	drillgroup.rotation.z = THREE.MathUtils.degToRad(angle);
	drillAngle.value = angle;
	showHideClupi();
};

let drillHeight = { value: 0 };
function setDrillHeight(height){
	drillgroup.position.y = (height / 100) + drillGroupHeight;
	drillHeight.value = height;
	showHideClupi();
};

function showHideClupi(){
	if(clupiVisAll.visible == true) {
		clupiVis.visible = true;
		// if clupi sees the fov1 mirror, show that view
		if(drillgroup.position.y == drillGroupHeight && drillgroup.rotation.z == drillGroupAngle){
			clupif1Vis.visible = true;
			clupif2Vis.visible = false;
			clupif3Vis.visible = false;
		}
		// otherwise show fov 2/3
		else {
			clupif1Vis.visible = false;
			clupif2Vis.visible = true;
			clupif3Vis.visible = true;
		}
	} else {
		clupiVis.visible = false;
		clupif1Vis.visible = false;
		clupif2Vis.visible = false;
		clupif3Vis.visible = false;
	}
};

// ======================== scene & menu setup ========================
function setupScene(){
	// create the scene
	scene.background = new THREE.Color( 'grey' );
	// add lighting
	const color = 0xFFFFFF;
	const intensity = 3;
	const sunlight = new THREE.DirectionalLight( color, intensity );
	sunlight.position.set( 0, 10, 0 );
	sunlight.target.position.set( -5, 0, 0 );
	scene.add( sunlight );
	scene.add( sunlight.target );

	const frontlight = new THREE.DirectionalLight( color, intensity );
	frontlight.position.set( 0, 10, -10 );
	frontlight.target.position.set( 0, 0.2, 0 );
	scene.add( frontlight );
	scene.add( frontlight.target );

	// add the floor plane
	const planeSize = 10;
	const loader = new THREE.TextureLoader();
	const texture = loader.load( 'assets/checker.png' );
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.magFilter = THREE.NearestFilter;
	const repeats = planeSize / 2;
	texture.repeat.set( repeats, repeats );
	const planeGeo = new THREE.PlaneGeometry( planeSize, planeSize );
	const planeMat = new THREE.MeshPhongMaterial( {
		map: texture,
		side: THREE.DoubleSide,
	} );
	const mesh = new THREE.Mesh( planeGeo, planeMat );
	mesh.rotation.x = Math.PI * - .5;
	scene.add( mesh );

	// main viewing camera
	const fov = 45;
	const aspect = 2; // the canvas default
	const near = 0.1;
	const far = 100;
	camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
	camera.position.set( 0, 2, -8 );

	// camera orbits PanCam
	const controls = new OrbitControls( camera, canvas );
	controls.target.set( 0, 1, 0 );
	controls.update();

	// create rover; pan and tilt managed separately to keep rotation clean
	let rfrBody, rfrMastHead, rfrDrillbox;
	tiltGroup = new THREE.Group();
	panGroup = new THREE.Group();
	drillgroup = new THREE.Group();

	// import the basic rover model
	const loaderglb = new GLTFLoader();
	loaderglb.load( 'assets/rfr_body_nodrill.glb', function ( gltf ) {
		scene.add( gltf.scene );
		rfrBody = gltf.scene.getObjectByName("body");
	}, undefined, function ( error ) {
		console.error( error );
	});
	// import the basic PanCam model
	loaderglb.load( 'assets/rfr_masthead.glb', function ( gltf ) {
		scene.add( gltf.scene );
		rfrMastHead = gltf.scene.getObjectByName("masthead");
		tiltGroup.add(rfrMastHead);

	}, undefined, function ( error ) {
		console.error( error );
	});
	// import the drill model
	loaderglb.load( 'assets/rfr_drill.glb', function ( gltf ) {
		scene.add( gltf.scene );
		rfrDrillbox = gltf.scene.getObjectByName("drillaxis");
		drillgroup.add(rfrDrillbox);

	}, undefined, function ( error ) {
		console.error( error );
	});

	// WACs and HRC camera setup and relative positioning
	const wacfov = 38;
	const pcaspect = 1; 
	const wacnear = 1;
	const wacfar = 2;
	const hrcfov = 4.88;
	const hrcnear = 0.98;
	const hrcfar = 2.02;
	lwac = new THREE.PerspectiveCamera( wacfov, pcaspect, wacnear, wacfar );
	rwac = new THREE.PerspectiveCamera( wacfov, pcaspect, wacnear, wacfar );
	hrc = new THREE.PerspectiveCamera( hrcfov, pcaspect, hrcnear, hrcfar );
	const wacposx = 0.25;
	const hrcposx = 0.154;
	const pcposy = 0.155;
	const pcposz = -0.02;
	lwac.position.set( -wacposx, pcposy, pcposz );
	rwac.position.set( wacposx, pcposy, pcposz );
	hrc.position.set( hrcposx, pcposy, pcposz );
	const toeinrad = 0.08;
	lwac.rotateY(-toeinrad);
	rwac.rotateY(toeinrad);

	// Enfys
	const enfysfov = 1;
	const enfysnear = 0.98;
	const enfysfar = 2.02;
	const enfysposy = pcposy-0.07;
	enfys = new THREE.PerspectiveCamera( enfysfov, pcaspect, enfysnear, enfysfar );
	enfys.position.set( hrcposx, enfysposy, pcposz );

	// CLUPI 2652 x 1768
	const clupifov = 14;
	const clupiaspectX = 2652;
	const clupiaspectY = 1768;
	const clupiaspect = clupiaspectX/clupiaspectY;
	const clupifov2aspectY = 1128;
	const clupifov2aspect = clupiaspectX/clupifov2aspectY;
	const clupifov3aspectY = 640;
	const clupifov3aspect = clupiaspectX/clupifov3aspectY;
	const clupinear = 0.1;
	const clupifar = 0.35;
	clupi = new THREE.PerspectiveCamera( clupifov, clupiaspect, 0.1, 0.2 );
	clupi_fov_1 = new THREE.PerspectiveCamera( clupifov, clupiaspect, 0.001, 0.35 );
	clupi_fov_2 = new THREE.PerspectiveCamera( clupifov/(clupiaspectY/clupifov2aspectY), clupifov2aspect, 0.001, 0.25 );
	clupi_fov_3 = new THREE.PerspectiveCamera( clupifov/(clupiaspectY/clupifov3aspectY), clupifov3aspect, 0.001, 0.27 );
	// clupi_fov_2.setViewOffset( clupiaspectX, clupiaspectY, 0, 0, clupiaspectX, clupifov2aspectY )
	// clupi_fov_3.setViewOffset( clupiaspectX, clupiaspectY, 1, 0, clupiaspectX, clupifov3aspectY )

	// NavCam (1280x1024 5.3um pixels)
	const navcamGroup = new THREE.Group();
	const navfov = 68.5;
	const navaspect = 1280/1024; 
	const navnear = 1.99;
	navfar = 2;
	const navposx = 0.075;
	lnav = new THREE.PerspectiveCamera( navfov, navaspect, navnear, navfar );
	rnav = new THREE.PerspectiveCamera( navfov, navaspect, navnear, navfar );
	lnav.position.set( -navposx, pcposy, pcposz );
	rnav.position.set( navposx, pcposy, pcposz );
	navcamGroup.add(lnav);
	navcamGroup.add(rnav);

	// LocCam
	const lrad = THREE.MathUtils.degToRad(18); // LocCam tilted down 18deg
	const loccamGroup = new THREE.Group();
	lloc = new THREE.PerspectiveCamera( navfov, navaspect, navnear, navfar );
	rloc = new THREE.PerspectiveCamera( navfov, navaspect, navnear, navfar );
	lloc.position.set( -navposx, pcposy, pcposz );
	rloc.position.set( navposx, pcposy, pcposz );
	loccamGroup.add(lloc);
	loccamGroup.add(rloc);
	loccamGroup.position.set(0, 0.7, -0.5);
	loccamGroup.rotateX(-lrad);
	scene.add(loccamGroup);

	// create helpers to do the visualisation
	lwacVis = new THREE.CameraHelper(lwac);
	rwacVis = new THREE.CameraHelper(rwac);
	hrcVis = new THREE.CameraHelper(hrc);
	enfysVis = new THREE.CameraHelper(enfys);
	clupiVis = new THREE.CameraHelper(clupi);
	clupif1Vis = new THREE.CameraHelper(clupi_fov_1);
	clupif2Vis = new THREE.CameraHelper(clupi_fov_2);
	clupif3Vis = new THREE.CameraHelper(clupi_fov_3);
	lnavVis = new THREE.CameraHelper(lnav);
	rnavVis = new THREE.CameraHelper(rnav);
	llocVis = new THREE.CameraHelper(lloc);
	rlocVis = new THREE.CameraHelper(rloc);
	scene.add(lwacVis);
	scene.add(rwacVis);
	scene.add(hrcVis);
	scene.add(enfysVis);
	scene.add(clupiVis);
	scene.add(clupif1Vis);
	// scene.add(clupif2Vis);
	// scene.add(clupif3Vis);
	scene.add(lnavVis);
	scene.add(rnavVis);
	scene.add(llocVis);
	scene.add(rlocVis);

	// start them not visible
	lwacVis.visible = false;
	rwacVis.visible = false;
	hrcVis.visible = false;
	enfysVis.visible = false;
	clupiVis.visible = false;
	clupif1Vis.visible = false;
	// clupif2Vis.visible = false;
	// clupif3Vis.visible = false;
	lnavVis.visible = false;
	rnavVis.visible = false;
	llocVis.visible = false;
	rlocVis.visible = false;

	const colorFrustum = new THREE.Color( 0xffaa00 );
	const colorCone = new THREE.Color( 0x000000 );
	const colorUp = new THREE.Color( 0x00aaff );
	const colorTarget = new THREE.Color( 0xffffff );
	const colorCross = new THREE.Color( 0x333333 );
	clupif1Vis.setColors(colorFrustum, colorCone, colorUp, colorTarget, colorCross);

	// add them to the tilt group
	tiltGroup.add(lwac);
	tiltGroup.add(rwac);
	tiltGroup.add(hrc);
	tiltGroup.add(enfys);
	tiltGroup.add(navcamGroup);

	// then pan group
	panGroup.position.set(0, 1.9, -0.5);
	panGroup.add(tiltGroup);

	// finally, add it all to the scene
	scene.add(panGroup);

	// setup the drill and clupi group
	drillgroup.position.set(-0.2, drillGroupHeight, -0.605);
	// main clupi
	clupi.rotateY(THREE.MathUtils.degToRad(90));
	clupi.position.set(0, -0.12, -0.12);
	drillgroup.add(clupi);
	// fov 1
	clupi_fov_1.rotateX(THREE.MathUtils.degToRad(-60));
	clupi_fov_1.position.set(-0.2, -0.12, -0.12);
	drillgroup.add(clupi_fov_1);
	// fov 2
	clupi_fov_2.rotateY(THREE.MathUtils.degToRad(90));
	clupi_fov_2.position.set(0, -0.12, -0.12);
	drillgroup.add(clupi_fov_2);
	// fov 3
	clupi_fov_3.rotateY(THREE.MathUtils.degToRad(90));
	clupi_fov_1.rotateX(THREE.MathUtils.degToRad(0));
	clupi_fov_3.position.set(0, -0.12, -0.12);
	drillgroup.add(clupi_fov_3);
	scene.add(drillgroup);
};

function setupMenus(){
	gui = new GUI( { 
		title: "VisPTU Control Panel",
		container: document.getElementById('gui'),
	} );

	let roverPos = {
		homeAll: function(){ 
			setPan(0); setTilt(0); 
			setDrillAngle(0); setDrillHeight(0); },
		showAllCam: function(){ 
			lwacVis.visible = true;
			rwacVis.visible = true;
			hrcVis.visible = true;
			enfysVis.visible = true;
		},
		hideAllCam: function(){ 
			lwacVis.visible = false;
			rwacVis.visible = false;
			hrcVis.visible = false;
			enfysVis.visible = false;
		},
	};

	gui.add(roverPos, 'homeAll').name("Reset Rover");
	gui.add(roverPos, 'showAllCam').name("Show All PanCam & Enfys");
	gui.add(roverPos, 'hideAllCam').name("Hide All PanCam & Enfys");

	let ptuPos = {
		pctRwac: function(){ setPan(-43.5); setTilt(65.75); },
		pctLwac: function(){ setPan(-70); setTilt(65.75); },
		parkPanCam: function(){ setPan(0); setTilt(60 ); },
		homePTU: function(){ setPan(0); setTilt(0); },
	};
	const ptucFolder = gui.addFolder( 'PTU Controls' );
	ptucFolder.add(panAngle, 'value').name("Pan (deg)").min(-180).max(180).onChange( value => { setPan(value) }).listen();
	ptucFolder.add(tiltAngle, 'value').name("Tilt (deg)").min(-90).max(90).onChange( value => { setTilt(value) }).listen();
	ptucFolder.add(ptuPos, 'pctRwac').name("RWAC PCT");
	ptucFolder.add(ptuPos, 'pctLwac').name("LWAC PCT");
	ptucFolder.add(ptuPos, 'parkPanCam').name("Park PanCam");
	ptucFolder.add(ptuPos, 'homePTU').name("Home PTU");
	ptucFolder.close();

	let drillPos = {
		homeDrill: function(){ setDrillAngle(0); setDrillHeight(0); },
	};
	const dcFolder = gui.addFolder( 'Drill Controls' );
	dcFolder.add(drillAngle, 'value').name("Drill Angle (deg)").min(0).max(140).onChange( value => { setDrillAngle(value) });
	dcFolder.add(drillHeight, 'value').name("Drill Height (cm)").min(-10).max(20).onChange( value => { setDrillHeight(value) });
	dcFolder.add(drillPos, 'homeDrill').name("Home Drill");
	dcFolder.close();

	const cvFolder = gui.addFolder( 'Toggle Camera Visualisation' );
	cvFolder.add(lwacVis, 'visible').name("Show LWAC").listen();
	cvFolder.add(rwacVis, 'visible').name("Show RWAC").listen();
	cvFolder.add(hrcVis, 'visible').name("Show HRC").listen();
	cvFolder.add(enfysVis, 'visible').name("Show Enfys").listen();
	cvFolder.add(navcams, 'visible').name("Show NavCams").onChange( value => { lnavVis.visible = value; rnavVis.visible = value }).listen();
	cvFolder.add(navcams, 'visible').name("Show LocCams").onChange( value => { llocVis.visible = value; rlocVis.visible = value }).listen();
	cvFolder.add(clupiVisAll, 'visible').name("Show CLUPI").onChange( value => { showHideClupi() } ).listen();
	cvFolder.close();

	const ccFolder = gui.addFolder( 'Camera Focus Distance' );
	const viewStepSize = 0.1, viewMin = 2, viewMax = 10;
	ccFolder.add(lwac, 'far', viewMin, viewMax).name("LWAC (m)").step(viewStepSize);
	ccFolder.add(rwac, 'far', viewMin, viewMax).name("RWAC (m)").step(viewStepSize);
	ccFolder.add(hrc, 'far', viewMin, viewMax).name("HRC (m)").step(viewStepSize);
	ccFolder.add(enfys, 'far', viewMin, viewMax).name("Enfys (m)").step(viewStepSize);
	ccFolder.add(navcams, 'viewFar').name("NavCams (m)").step(viewStepSize).min(viewMin).max(viewMax).onChange( value => { lnav.far = value; rnav.far = value });
	ccFolder.close();

	const psFolder = gui.addFolder( 'Pan Panorama Planner (Fixed Tilt)' );
	psFolder.add(panoSpec, 'start').name('Pan Start (deg)').min(-180).max(180).listen();
	psFolder.add(panoSpec, 'stop',).name('Pan Stop (deg)').min(-180).max(180).listen();
	psFolder.add(panoSpec, 'numPics', 2, 30, 1 ).name('Number of Images').listen();
	psFolder.add(tiltAngle, 'value').name("Tilt (deg)").min(-90).max(90).onChange( value => { setTilt(value) }).listen();
	psFolder.add(panoSpec, 'lwac').name("Use LWAC").listen();
	psFolder.add(panoSpec, 'rwac').name("Use RWAC").listen();
	psFolder.add(panoSpec, 'hrc').name("Use HRC").listen();
	psFolder.add(panoSpec, 'enfys').name("Use Enfys").listen();
	psFolder.add(panoSpec, 'nav').name("Use NavCams").listen();
	psFolder.add(panoSpec, 'panoPlan').name("Plan Pano");
	psFolder.add(panoSpec, 'clearPanoPlan').name("Clear Plan");
	psFolder.add(panoSpec, 'clearVisualisation').name(" Clear Visualisation")
};

// ======================== rendering ========================
function updateCamera() {
	camera.updateProjectionMatrix();
};

function resizeRendererToDisplaySize( renderer ) {
	const canvas = renderer.domElement;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const needResize = canvas.width !== width || canvas.height !== height;
	if ( needResize ) { renderer.setSize( width, height, false ); }
	return needResize;
};

function render() {
	resizeRendererToDisplaySize(renderer);
	const canvas = renderer.domElement;
	camera.aspect = canvas.clientWidth / canvas.clientHeight;
	camera.updateProjectionMatrix();
	
	lwac.updateProjectionMatrix();
	rwac.updateProjectionMatrix();
	hrc.updateProjectionMatrix();
	enfys.updateProjectionMatrix();
	clupi.updateProjectionMatrix();
	lnav.updateProjectionMatrix();
	rnav.updateProjectionMatrix();

	lwacVis.update();
	rwacVis.update();
	hrcVis.update();
	enfysVis.update();
	clupiVis.update();
	lnavVis.update();
	rnavVis.update();

	renderer.render( scene, camera );
	requestAnimationFrame( render );
};

function main() {
	setupScene();
	setupMenus();
	requestAnimationFrame( render );
};

main();