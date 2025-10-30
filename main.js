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
		light.target.position.set( - 5, 0, 0 );
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

		// import the basic rover model
		
		const loaderglb = new GLTFLoader();
		loaderglb.load( 'assets/rfr.glb', function ( gltf ) {
			scene.add( gltf.scene );
			rfrBody = gltf.scene.getObjectByName("body");
			rfrMastHead = gltf.scene.getObjectByName("masthead");
		}, undefined, function ( error ) {
			console.error( error );
		});
	}

	

	// create PanCam
	const mastheadGroup = new THREE.Group();
	mastheadGroup.position.set(0, 1, 0);
	// mastheadGroup.position.set(0, 1, -0.26);
	// WACs and HRC
	const wacfov = 38;
	const pcaspect = 1; 
	const wacnear = 1;
	const wacfar = 2;
	const lwac = new THREE.PerspectiveCamera( wacfov, pcaspect, wacnear, wacfar );
	const rwac = new THREE.PerspectiveCamera( wacfov, pcaspect, wacnear, wacfar );
	const hrc = new THREE.PerspectiveCamera( 4.88, 1, 0.98, 3 );
	const wacposx = 0.25;
	const hrcposx = 0.154;
	const pcposy = 0; // 2
	const pcposz = 0;//-0.52;
	lwac.position.set( -wacposx, pcposy, pcposz );
	rwac.position.set( wacposx, pcposy, pcposz );
	hrc.position.set( hrcposx, pcposy, pcposz );
	const toeinrad = 0.08;
	lwac.rotateY(-toeinrad);
	rwac.rotateY(toeinrad);
	// scene.add(lwac);
	// scene.add(rwac);
	// scene.add(hrc);
	const lwacVis = new THREE.CameraHelper(lwac);
	const rwacVis = new THREE.CameraHelper(rwac);
	const hrcVis = new THREE.CameraHelper(hrc);
	// scene.add(lwacVis);
	// scene.add(rwacVis);
	// scene.add(hrcVis);

	
	if(rfrMastHead){mastheadGroup.add(rfrMastHead);}
	mastheadGroup.add(lwac);
	mastheadGroup.add(rwac);
	mastheadGroup.add(hrc);
	mastheadGroup.add(lwacVis);
	mastheadGroup.add(rwacVis);
	mastheadGroup.add(hrcVis);
	scene.add(mastheadGroup)

	function updatePanCam() {
		// lwacVis.update();
		lwac.updateProjectionMatrix();
		rwac.updateProjectionMatrix();
		hrc.updateProjectionMatrix();
	}

	function panPTU(panIncrement){
		if(rfrMastHead){
			rfrMastHead.rotation.y += degToRad(panIncrement);
		}
	}
	function tiltPTU(tiltIncrement){
		if(rfrMastHead){
			rfrMastHead.rotation.x += degToRad(tiltIncrement);
		}
	}
	function ptuRange(){
		if(rfrMastHead){
			do {
				tiltPTU(1)
			} while(rfrMastHead.rotation.x > degToRad(90))
			console.log(rfrMastHead)
		}
	}

	const gui = new GUI();
	gui.add(lwac, 'far', 2, 10).name("lwac far").step(0.1);
	// gui.add(mastheadGroup.rotation, 'x', 0, Math.PI/4).name("tilt");
	gui.add(mastheadGroup.rotation, 'y', -Math.PI/2, Math.PI/2).name("pan");
	// gui.add( rfrMastHead, 'pan', 1, 180 ).onChange( panPTU, 1 );
	// const minMaxGUIHelper = new MinMaxGUIHelper( camera, 'near', 'far', 0.1 );
	// gui.add( minMaxGUIHelper, 'min', 0.1, 50, 0.1 ).name( 'near' ).onChange( updateCamera );
	// gui.add( minMaxGUIHelper, 'max', 0.1, 50, 0.1 ).name( 'far' ).onChange( updateCamera );

	if(rfrMastHead){
		console.log("rfrMastHead")
		gui.add( rfrMastHead, 'pan', 1, 180 ).onChange( panPTU );
	}

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