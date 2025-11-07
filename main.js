import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from '/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

function degToRad(deg){
	return deg * (Math.PI / 180)
}

function main() {
	const canvas = document.querySelector( '#c' );
	const renderer = new THREE.WebGLRenderer( { antialias: true, canvas } );
	const gui = new GUI();

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
	let rfrBody, rfrMastHead;

	{
		scene.background = new THREE.Color( 'grey' );

		// add lighting
		const color = 0xFFFFFF;
		const intensity = 3;
		const light = new THREE.DirectionalLight( color, intensity );
		light.position.set( 0, 10, 0 );
		light.target.position.set( -5, 0, 0 );
		scene.add( light );
		scene.add( light.target );

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

	// import the basic rover model
	const loaderglb = new GLTFLoader();
	loaderglb.load( 'assets/rfr_body.glb', function ( gltf ) {
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

	// WACs and HRC camera setup and relative positioning
	const wacfov = 38;
	const pcaspect = 1; 
	const wacnear = 1;
	const wacfar = 2;
	const lwac = new THREE.PerspectiveCamera( wacfov, pcaspect, wacnear, wacfar );
	const rwac = new THREE.PerspectiveCamera( wacfov, pcaspect, wacnear, wacfar );
	const hrc = new THREE.PerspectiveCamera( 4.88, 1, 0.98, 2.02 );
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

	// create helpers to do the visualisation
	const lwacVis = new THREE.CameraHelper(lwac);
	const rwacVis = new THREE.CameraHelper(rwac);
	const hrcVis = new THREE.CameraHelper(hrc);
	scene.add(lwacVis);
	scene.add(rwacVis);
	scene.add(hrcVis);
	// start them not visible
	lwacVis.visible = false;
	rwacVis.visible = false;
	hrcVis.visible = false;

	// add them to the tilt group
	tiltGroup.add(lwac);
	tiltGroup.add(rwac);
	tiltGroup.add(hrc);

	// then pan group
	panGroup.position.set(0, 1.9, -0.5);
	panGroup.add(tiltGroup);

	// finally, add it all to the scene
	scene.add(panGroup);

	// panning and tilting from degrees
	let panAngle = { value: 0 };
	function setPan(angle){
		// take degrees and turn to rads
		panGroup.rotation.y = degToRad(angle);
		panAngle.value = angle;
	}
	let tiltAngle = { value: 0 };
	function setTilt(angle){
		// take degrees and turn to rads, note that tilt is opposite direction
		tiltGroup.rotation.x = -1 * degToRad(angle);
		tiltAngle.value = angle;
	}
	
	let ptuPos = {
		pctRwac: function(){ setPan(-43.5); setTilt(65.75); },
		pctLwac: function(){ setPan(-70); setTilt(65.75); },
		parkPanCam: function(){ setPan(0); setTilt(60 ); },
		homePTU: function(){ setPan(0); setTilt(0); },
		// pancamView: function(){  },
	};

	const ptucFolder = gui.addFolder( 'PTU Controls' ).close();
	ptucFolder.add(panAngle, 'value').name("Pan (deg)").min(-180).max(180).onChange( value => { setPan(value) }).listen();
	ptucFolder.add(tiltAngle, 'value').name("Tilt (deg)").min(-90).max(90).onChange( value => { setTilt(value) }).listen();
	ptucFolder.add(ptuPos, 'pctRwac').name("RWAC PCT");
	ptucFolder.add(ptuPos, 'pctLwac').name("LWAC PCT");
	ptucFolder.add(ptuPos, 'parkPanCam').name("Park PanCam");
	ptucFolder.add(ptuPos, 'homePTU').name("Home PTU");
	// ptucFolder.add(ptuPos,'pancamView').name("View from PTU"); // TODO?

	const ccFolder = gui.addFolder( 'Camera Controls' ).close();
	ccFolder.add(lwac, 'far', 2, 10).name("LWAC distance area (m)").step(0.1);
	ccFolder.add(rwac, 'far', 2, 10).name("RWAC distance area (m)").step(0.1);
	ccFolder.add(hrc, 'far', 2, 10).name("HRC distance area (m)").step(0.1);
	ccFolder.add(lwacVis, 'visible').name("Show LWAC");
	ccFolder.add(rwacVis, 'visible').name("Show RWAC");
	ccFolder.add(hrcVis, 'visible').name("Show HRC");

	function addPanoImg(position, direction, group, camID){
		// get far vector and setup for correct camera
		let facingPos = panGroup.position;
		let farVec = lwac.far;
		let x = 1.4, y = 1.4;

		// materials: red = lwac, green = rwac, blue = hrc
		let material = new THREE.MeshBasicMaterial( {color: 0x886666, side: THREE.DoubleSide, transparent: true, opacity: 0.4} );
		
		if(camID == "lwac"){ 
			farVec = rwac.far; 
		}
		else if(camID == "rwac"){ 
			farVec = rwac.far;
			material = new THREE.MeshBasicMaterial( {color: 0x668866, side: THREE.DoubleSide, transparent: true, opacity: 0.4} );
		}
		else if(camID == "hrc"){
			material = new THREE.MeshBasicMaterial( {color: 0x666688, side: THREE.DoubleSide, transparent: true, opacity: 0.4} );
			farVec = hrc.far; 
			x = 0.25;
			y = 0.25;
		}

		// take a position and generate an element (pic) for the panorama
		const geometry = new THREE.PlaneGeometry( x, y );
		const image = new THREE.Mesh( geometry, material );
	    image.position.copy( position );
	    image.position.addScaledVector( direction, farVec );
	    image.lookAt( facingPos );
	    image.name = "panoElement";
		group.add( image );
	}

	let panoElements = new THREE.Object3D()
	panoElements.name = "panoElements";

	function panPlan(start, stop, numPics, useLwac, useRwac, useHrc){
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
		panPlan: function(){ 
			panPlan(this.start, this.stop, this.numPics, this.lwac, this.rwac, this.hrc); 
			// TODO work out percentage overlap??
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
			if(scene.getObjectByName("panoElements")){
				panoElements.clear();
			}
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
	psFolder.add(panSpec, 'panPlan').name("Plan Pano");
	psFolder.add(panSpec, 'clearPanPlan').name("Clear Pano Plan");
	
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

		lwacVis.update();
		rwacVis.update();
		hrcVis.update();

		renderer.render( scene, camera );
		requestAnimationFrame( render );
	}
	requestAnimationFrame( render );
}

main();