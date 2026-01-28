import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from '/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

function main() {
	const canvas = document.querySelector( '#c' );
	const renderer = new THREE.WebGLRenderer( { antialias: true, canvas } );
	const gui = new GUI( { 
		// container: document.getElementById( 'panel' ), 
		title: "VisPTU Control Panel",
		// closeFolders: true,
	} );

	// main viewing camera
	const fov = 45;
	const aspect = 2; // the canvas default
	const near = 0.1;
	const far = 100;
	const camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
	camera.position.set( 0, 2, -8 );

	function updateCamera() {
		camera.updateProjectionMatrix();
	}

	// camera orbits PanCam
	const controls = new OrbitControls( camera, canvas );
	controls.target.set( 0, 2, 0 );
	controls.update();

	class MinMaxGUIHelper {
		constructor( obj, minProp, maxProp, minDif ) {
			this.obj = obj;
			this.minProp = minProp;
			this.maxProp = maxProp;
			this.minDif = minDif;
		}
		get min() {
			return this.obj[ this.minProp ];
		}
		set min( v ) {
			this.obj[ this.minProp ] = v;
			this.obj[ this.maxProp ] = Math.max( this.obj[ this.maxProp ], v + this.minDif );
		}
		get max() {
			return this.obj[ this.maxProp ];
		}
		set max( v ) {
			this.obj[ this.maxProp ] = v;
			this.min = this.min; // this will call the min setter
		}
	}

	// create the scene
	const scene = new THREE.Scene();
	let rfrBody, rfrMastHead, rfrDrillbox;

	{
		scene.background = new THREE.Color( 'grey' );

		// add lighting
		const color = 0xFFFFFF;
		const intensity = 3;
		const sunlight = new THREE.DirectionalLight( color, intensity );
		sunlight.position.set( 0, 10, 0 );
		sunlight.target.position.set( -5, 0, 0 );
		scene.add( sunlight );
		scene.add( sunlight.target );

		const frontlight = new THREE.DirectionalLight( color, 1 );
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
	}	

	// create PanCam
	// pan and tilt managed separately to keep rotation clean
	const tiltGroup = new THREE.Group();
	const panGroup = new THREE.Group();

	const drillgroup = new THREE.Group();

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
	const lwac = new THREE.PerspectiveCamera( wacfov, pcaspect, wacnear, wacfar );
	const rwac = new THREE.PerspectiveCamera( wacfov, pcaspect, wacnear, wacfar );
	const hrc = new THREE.PerspectiveCamera( hrcfov, pcaspect, hrcnear, hrcfar );
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
	const enfys = new THREE.PerspectiveCamera( enfysfov, pcaspect, enfysnear, enfysfar );
	enfys.position.set( hrcposx, enfysposy, pcposz );

	// CLUPI 2652 x 1768
	const clupifov = 14;
	const clupiaspectX = 2652;
	const clupiaspectY = 1768;
	const clupiaspect = clupiaspectX/clupiaspectY;
	const clupinear = 0.1;
	const clupifar = 0.35;
	const clupi = new THREE.PerspectiveCamera( clupifov, clupiaspect, 0.1, 0.2 );

	// LocCam tilted down 18deg
	const lrad = THREE.MathUtils.degToRad(18);

	// NavCam (1280x1024 5.3um pixels)
	const navcamGroup = new THREE.Group();
	const navfov = 68.5;
	const navaspect = 1280/1024; 
	const navnear = 1.99;
	const navfar = 2;
	const navposx = 0.075;
	const lnav = new THREE.PerspectiveCamera( navfov, navaspect, navnear, navfar );
	const rnav = new THREE.PerspectiveCamera( navfov, navaspect, navnear, navfar );
	lnav.position.set( -navposx, pcposy, pcposz );
	rnav.position.set( navposx, pcposy, pcposz );
	navcamGroup.add(lnav);
	navcamGroup.add(rnav);

	// LocCam
	const loccamGroup = new THREE.Group();
	const lloc = new THREE.PerspectiveCamera( navfov, navaspect, navnear, navfar );
	const rloc = new THREE.PerspectiveCamera( navfov, navaspect, navnear, navfar );
	lloc.position.set( -navposx, pcposy, pcposz );
	rloc.position.set( navposx, pcposy, pcposz );
	loccamGroup.add(lloc);
	loccamGroup.add(rloc);
	loccamGroup.position.set(0, 0.7, -0.5);
	loccamGroup.rotateX(-lrad);
	scene.add(loccamGroup);

	// create helpers to do the visualisation
	const lwacVis = new THREE.CameraHelper(lwac);
	const rwacVis = new THREE.CameraHelper(rwac);
	const hrcVis = new THREE.CameraHelper(hrc);
	const enfysVis = new THREE.CameraHelper(enfys);
	const clupiVis = new THREE.CameraHelper(clupi);
	const lnavVis = new THREE.CameraHelper(lnav);
	const rnavVis = new THREE.CameraHelper(rnav);
	const llocVis = new THREE.CameraHelper(lloc);
	const rlocVis = new THREE.CameraHelper(rloc);
	scene.add(lwacVis);
	scene.add(rwacVis);
	scene.add(hrcVis);
	scene.add(enfysVis);
	scene.add(clupiVis);
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
	lnavVis.visible = false;
	rnavVis.visible = false;
	llocVis.visible = false;
	rlocVis.visible = false;

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
	// const drillWidth
	const drillGroupHeight = 0.44;
	const drillGroupAngle = 0;
	drillgroup.position.set(-0.2, drillGroupHeight, -0.605);
	// main clupi
	clupi.rotateY(THREE.MathUtils.degToRad(90));
	clupi.position.set(0, -0.12, -0.12);
	drillgroup.add(clupi);
	scene.add(drillgroup);

	let clupiVisAll = {	
		visible: false, 
	};

	// panning and tilting from degrees
	let panAngle = { value: 0 };
	function setPan(angle){
		// take degrees and turn to rads
		panGroup.rotation.y = THREE.MathUtils.degToRad(angle);
		panAngle.value = angle;
	}
	let tiltAngle = { value: 0 };
	function setTilt(angle){
		// take degrees and turn to rads, note that tilt is opposite direction
		tiltGroup.rotation.x = -1 * THREE.MathUtils.degToRad(angle);
		tiltAngle.value = angle;
	}
	// translation and rotation for drillbox
	let drillAngle = { value: 0 };
	function setDrillAngle(angle){
		// take degrees and turn to rads
		drillgroup.rotation.z = THREE.MathUtils.degToRad(angle);
		drillAngle.value = angle;
		showHideClupi();
	}
	let drillHeight = { value: 0 };
	function setDrillHeight(height){
		drillgroup.position.y = (height / 100) + drillGroupHeight;
		drillHeight.value = height;
		showHideClupi();
	}
	function showHideClupi(){
		if(clupiVisAll.visible == true) {
			clupiVis.visible = true;
		}
	}
	
	let ptuPos = {
		pctRwac: function(){ setPan(-43.5); setTilt(65.75); },
		pctLwac: function(){ setPan(-70); setTilt(65.75); },
		parkPanCam: function(){ setPan(0); setTilt(60 ); },
		homePTU: function(){ setPan(0); setTilt(0); },
		// pancamView: function(){  },
	};

	const ptucFolder = gui.addFolder( 'PTU Controls' );
	ptucFolder.add(panAngle, 'value').name("Pan (deg)").min(-180).max(180).onChange( value => { setPan(value) }).listen();
	ptucFolder.add(tiltAngle, 'value').name("Tilt (deg)").min(-90).max(90).onChange( value => { setTilt(value) }).listen();
	ptucFolder.add(ptuPos, 'pctRwac').name("RWAC PCT");
	ptucFolder.add(ptuPos, 'pctLwac').name("LWAC PCT");
	ptucFolder.add(ptuPos, 'parkPanCam').name("Park PanCam");
	ptucFolder.add(ptuPos, 'homePTU').name("Home PTU");
	// ptucFolder.close();
	// ptucFolder.add(ptuPos,'pancamView').name("View from PTU"); // TODO?

	const dcFolder = gui.addFolder( 'Drill Controls' );
	dcFolder.add(drillAngle, 'value').name("Drill Angle (deg)").min(0).max(140).onChange( value => { setDrillAngle(value) });
	dcFolder.add(drillHeight, 'value').name("Drill Height (cm)").min(-10).max(20).onChange( value => { setDrillHeight(value) });
	dcFolder.add(clupiVisAll, 'visible').name("Show CLUPI").onChange( value => { showHideClupi() } );
	dcFolder.close();

	let navcams = {	
		visible: false, 
		viewFar: navfar,
	};

	const ccFolder = gui.addFolder( 'Camera Controls' );
	const viewStepSize = 0.1, viewMin = 2, viewMax = 10;
	ccFolder.add(lwac, 'far', viewMin, viewMax).name("LWAC distance area (m)").step(viewStepSize);
	ccFolder.add(rwac, 'far', viewMin, viewMax).name("RWAC distance area (m)").step(viewStepSize);
	ccFolder.add(hrc, 'far', viewMin, viewMax).name("HRC focus distance (m)").step(viewStepSize);
	ccFolder.add(enfys, 'far', viewMin, viewMax).name("Enfys focus distance (m)").step(viewStepSize);
	ccFolder.add(navcams, 'viewFar').name("NavCams distance area (m)").step(viewStepSize).min(viewMin).max(viewMax).onChange( value => { lnav.far = value; rnav.far = value });
	ccFolder.add(lwacVis, 'visible').name("Show LWAC");
	ccFolder.add(rwacVis, 'visible').name("Show RWAC");
	ccFolder.add(hrcVis, 'visible').name("Show HRC");
	ccFolder.add(enfysVis, 'visible').name("Show Enfys");
	ccFolder.add(navcams, 'visible').name("Show NavCams").onChange( value => { lnavVis.visible = value; rnavVis.visible = value });
	ccFolder.add(navcams, 'visible').name("Show LocCams").onChange( value => { llocVis.visible = value; rlocVis.visible = value });
	ccFolder.close();

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
	}

	let panoElements = new THREE.Object3D()
	panoElements.name = "panoElements";
	let panoElemArray = {};

	function panPlan(start, stop, numPics, useLwac, useRwac, useHrc, useNav){
		let camDirection = new THREE.Vector3();
		let camPosition = new THREE.Vector3();

	    // if there are any in the middle, deal with them
	    if((numPics - 2) > 0){
	    	// take start and stop angles, and divide by number of pics to get a spacing
			let sep = (stop - start) / (numPics-1); 
	    	let currPan = start;
	    	for(let p = 0; p < numPics; p++){
	    		if(p>0){ currPan += sep; }
				setPan(currPan);
				if(useLwac){
					lwac.getWorldDirection( camDirection );
				    lwac.getWorldPosition( camPosition );
				    addPanoImg(camPosition, camDirection, panoElements, "lwac");
				}
				if(useRwac){
					rwac.getWorldDirection( camDirection );
				    rwac.getWorldPosition( camPosition );
				    addPanoImg(camPosition, camDirection, panoElements, "rwac");
				}
				if (useHrc){
					hrc.getWorldDirection( camDirection );
				    hrc.getWorldPosition( camPosition );
				    addPanoImg(camPosition, camDirection, panoElements, "hrc");
				}
				if(useNav){
					lnav.getWorldDirection( camDirection );
				    lnav.getWorldPosition( camPosition );
				    addPanoImg(camPosition, camDirection, panoElements, "nav");
				}
				
			}
	    }
	   	else {
	   		// otherwise do first and last pics only (min 2)
			
			// pan to start pos and add pic
			setPan(start); 
			if(useLwac){
				lwac.getWorldDirection( camDirection );
			    lwac.getWorldPosition( camPosition );
			    addPanoImg(camPosition, camDirection, panoElements, "lwac");
			}
			if(useRwac){
				rwac.getWorldDirection( camDirection );
			    rwac.getWorldPosition( camPosition );
			    addPanoImg(camPosition, camDirection, panoElements, "rwac");
			}
			if (useHrc){
				hrc.getWorldDirection( camDirection );
			    hrc.getWorldPosition( camPosition );
			    addPanoImg(camPosition, camDirection, panoElements, "hrc");
			}
			if(useNav){
				lnav.getWorldDirection( camDirection );
			    lnav.getWorldPosition( camPosition );
			    addPanoImg(camPosition, camDirection, panoElements, "nav");
			    console.log('hi')
			}

			// no point adding two images if no movement (despite min being 2)
			if(stop != start){
				// pan to stop pos, add pic
				setPan(stop);
				if(useLwac){
					lwac.getWorldDirection( camDirection );
				    lwac.getWorldPosition( camPosition );
				    addPanoImg(camPosition, camDirection, panoElements, "lwac");
				}
				if(useRwac){
					rwac.getWorldDirection( camDirection );
				    rwac.getWorldPosition( camPosition );
				    addPanoImg(camPosition, camDirection, panoElements, "rwac");
				}
				if (useHrc){
					hrc.getWorldDirection( camDirection );
				    hrc.getWorldPosition( camPosition );
				    addPanoImg(camPosition, camDirection, panoElements, "hrc");
				}
				if(useNav){
					lnav.getWorldDirection( camDirection );
				    lnav.getWorldPosition( camPosition );
				    addPanoImg(camPosition, camDirection, panoElements, "nav");
				}
			}			
	   	}

	   	// reset pan to centre
	    setPan(0);
	    scene.add(panoElements);
	}	

	const psFolder = gui.addFolder( 'Pan Panorama Planner (Fixed Tilt)' );

	let panSpec = { 
		start: 0, 
		stop: 0, 
		numPics: 2,
		// overlap: 0,
		lwac: false,
		rwac: false,
		hrc: false,
		nav: false,
		panPlan: function(){ 
			// imageListFolder.show();
			panPlan(this.start, this.stop, this.numPics, this.lwac, this.rwac, this.hrc, this.nav); 
			// TODO work out percentage overlap??
			// imageListFolder.add( myObject, 'myNumber', { Label1: 0, Label2: 1, Label3: 2 } );
		},
		clearPanPlan: function(){ 
			// collect all the pics and clear them, reset variables
			this.start = 0;
			this.stop = 0;
			this.numPics = 2;
			// this.overlap = 0;
			this.lwac = false;
			this.rwac = false;
			this.hrc = false;
			this.nav = false;
			if(scene.getObjectByName("panoElements")){
				panoElements.clear();
			}
			// imageListFolder.hide();
		},
	};

	psFolder.add(panSpec, 'start').name('Pan Start (deg)').min(-180).max(180).listen();
	psFolder.add(panSpec, 'stop',).name('Pan Stop (deg)').min(-180).max(180).listen();
	psFolder.add(panSpec, 'numPics', 2, 30, 1 ).name('Number of Images').listen();
	// psFolder.add(panSpec, 'overlap').name("Approx overlap (%)").disable().listen();
	psFolder.add(tiltAngle, 'value').name("Tilt (deg)").min(-90).max(90).onChange( value => { setTilt(value) }).listen();
	psFolder.add(panSpec, 'lwac').name("Use LWAC").listen();
	psFolder.add(panSpec, 'rwac').name("Use RWAC").listen();
	psFolder.add(panSpec, 'hrc').name("Use HRC").listen();
	psFolder.add(panSpec, 'nav').name("Use NavCams").listen();
	psFolder.add(panSpec, 'panPlan').name("Plan Pano");
	psFolder.add(panSpec, 'clearPanPlan').name("Clear Pano Plan");
	// psFolder.close();

	function resizeRendererToDisplaySize( renderer ) {
		const canvas = renderer.domElement;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const needResize = canvas.width !== width || canvas.height !== height;
		if ( needResize ) { renderer.setSize( width, height, false ); }
		return needResize;
	}

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
	}
	requestAnimationFrame( render );
}

main();