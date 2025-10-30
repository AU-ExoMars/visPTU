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
	loaderglb.load( 'assets/rfr.glb', function ( gltf ) {
		scene.add( gltf.scene );
		rfrBody = gltf.scene.getObjectByName("body");
		rfrMastHead = gltf.scene.getObjectByName("masthead");
		rfrMastHead.position.set(0, 0.05, 0.03);
		tiltGroup.add(rfrMastHead);

		// useful for debuggung - get all the available named items
		// gltf.scene.traverse(function(child){
		//     console.log(child.name);
		// });

	}, undefined, function ( error ) {
		console.error( error );
	});

	// helper cube shows the ptu - for debugging
	// const geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );
	// const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
	// const cube = new THREE.Mesh( geometry, material );
	// tiltGroup.add( cube );

	// WACs and HRC camera setup and relative positioning
	const wacfov = 38;
	const pcaspect = 1; 
	const wacnear = 1;
	const wacfar = 2;
	const lwac = new THREE.PerspectiveCamera( wacfov, pcaspect, wacnear, wacfar );
	const rwac = new THREE.PerspectiveCamera( wacfov, pcaspect, wacnear, wacfar );
	const hrc = new THREE.PerspectiveCamera( 4.88, 1, 0.98, 3 );
	const wacposx = 0.25;
	const hrcposx = 0.154;
	const pcposy = 0.2;
	const pcposz = -0.02;
	lwac.position.set( -wacposx, pcposy, 0 );
	rwac.position.set( wacposx, pcposy, 0 );
	hrc.position.set( hrcposx, pcposy, 0 );
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

	// add them to the tilt group
	tiltGroup.add(lwac);
	tiltGroup.add(rwac);
	tiltGroup.add(hrc);

	// then pan group
	panGroup.position.set(0, 1.8, -0.52);
	panGroup.add(tiltGroup);

	// finally, add it all to the scene
	scene.add(panGroup);

	const gui = new GUI();
	const ptucFolder = gui.addFolder( 'PTU Controls' ).close();
	ptucFolder.add(tiltGroup.rotation, 'x', -Math.PI/2, Math.PI/2).name("Tilt").listen();
	ptucFolder.add(panGroup.rotation, 'y', -Math.PI, Math.PI).name("Pan").listen();
	ptucFolder.add(lwacVis, 'visible').name("Show LWAC");
	ptucFolder.add(rwacVis, 'visible').name("Show RWAC");
	ptucFolder.add(hrcVis, 'visible').name("Show HRC");

	const ccFolder = gui.addFolder( 'Camera Controls' ).close();
	ccFolder.add(lwac, 'far', 2, 10).name("LWAC distance area (m)").step(0.1);
	ccFolder.add(rwac, 'far', 2, 10).name("RWAC distance area (m)").step(0.1);
	ccFolder.add(hrc, 'far', 2, 10).name("HRC distance area (m)").step(0.1);

	function panPlan(start, stop, numPics){
		// take start and stop angles, and divide by number of pics to get a spacing
		var sep = Math.round((stop - start) / numPics);
		// console.log()
		// panGroup.rotation.y = start;
		// var lwacMatrix = lwac.matrixWorldInverse;

		// const geometry = new THREE.PlaneGeometry( 1, 1 );
		// const material = new THREE.MeshBasicMaterial( {color: 0xffff00, side: THREE.DoubleSide} );
		// const plane = new THREE.Mesh( geometry, material );
		// plane.setRotationFromMatrix(lwacMatrix);
		// plane.updateMatrixWorld();
		// // console.log(plane.matrix)
		// scene.add( plane );
	}	

	const psFolder = gui.addFolder( 'Pan Planner' );

	var panSpec = { start: 1, stop: 1, numPics: 2 };

	psFolder.add(panSpec, 'start', 0, Math.PI, 0.01 );
	psFolder.add(panSpec, 'stop', 0, Math.PI, 0.01 );
	psFolder.add(panSpec, 'numPics', 2, 30, 1 );
	// if any of them change, update the pan planner
	psFolder.onChange( event => {
		panPlan(event.object.start, event.object.stop, event.object.numPics);
	} );

	function resizeRendererToDisplaySize( renderer ) {
		const canvas = renderer.domElement;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const needResize = canvas.width !== width || canvas.height !== height;
		if ( needResize ) {
			renderer.setSize( width, height, false );
		}
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
		// ptuRange()
	}
	requestAnimationFrame( render );
}

main();