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

		// useful for debuggung - get all the available named items
		// gltf.scene.traverse(function(child){
		//     console.log(child.name);
		// });

	}, undefined, function ( error ) {
		console.error( error );
	});
	// import the basic rover model
	loaderglb.load( 'assets/rfr_masthead.glb', function ( gltf ) {
		scene.add( gltf.scene );
		rfrMastHead = gltf.scene.getObjectByName("masthead");
		// rfrMastHead.position.set(0, 0.02, 0);
		tiltGroup.add(rfrMastHead);

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
	var panAngle = { value: 0 };
	function setPan(angle){
		// take degrees and turn to rads
		panGroup.rotation.y = degToRad(angle);
		panAngle.value = angle;
	}
	var tiltAngle = { value: 0 };
	function setTilt(angle){
		// take degrees and turn to rads, note that tilt is opposite direction
		tiltGroup.rotation.x = -1 * degToRad(angle);
		tiltAngle.value = angle;
	}
	
	var ptuPos = {
		pctRwac: function(){ setPan(-43.5); setTilt(65.75); },
		pctLwac: function(){ setPan(-70); setTilt(65.75); },
		parkPanCam: function(){ setPan(0); setTilt(60 ); },
		homePTU: function(){ setPan(0); setTilt(0); },
	};

	const ptucFolder = gui.addFolder( 'PTU Controls' ).close();
	ptucFolder.add(panAngle, 'value').name("Pan (deg)").min(-180).max(180).onChange( value => { setPan(value) }).listen();
	ptucFolder.add(tiltAngle, 'value').name("Tilt (deg)").min(-90).max(90).onChange( value => { setTilt(value) }).listen();
	ptucFolder.add(ptuPos, 'pctRwac').name("RWAC PCT");
	ptucFolder.add(ptuPos, 'pctLwac').name("LWAC PCT");
	ptucFolder.add(ptuPos, 'parkPanCam').name("Park PanCam");
	ptucFolder.add(ptuPos, 'homePTU').name("Home PTU");

	const ccFolder = gui.addFolder( 'Camera Controls' ).close();
	ccFolder.add(lwac, 'far', 2, 10).name("LWAC distance area (m)").step(0.1);
	ccFolder.add(rwac, 'far', 2, 10).name("RWAC distance area (m)").step(0.1);
	ccFolder.add(hrc, 'far', 2, 10).name("HRC distance area (m)").step(0.1);
	ccFolder.add(lwacVis, 'visible').name("Show LWAC");
	ccFolder.add(rwacVis, 'visible').name("Show RWAC");
	ccFolder.add(hrcVis, 'visible').name("Show HRC");

	function panPlan(start, stop, numPics){
		// take start and stop angles, and divide by number of pics to get a spacing
		var sep = Math.round((stop - start) / numPics);
		// console.log(lwac.matrixWorld)
		// console.log(lwacVis.geometry)

		// var vector = new THREE.Vector3();
		// var zNearPlane = -1;
		// var zFarPlane = 1;
		// vector.set( -1, 1, zNearPlane ).unproject( lwac );// Top left corner
		// console.log(vector)
		// vector.set( 1, 1, zNearPlane ).unproject( lwac );// Top right corner
		// console.log(vector)
		// vector.set( -1, -1, zNearPlane ).unproject( lwac );// // Bottom left corner
		// console.log(vector)
		// vector.set( 1, -1, zNearPlane ).unproject( lwac );// Bottom right corner
		// console.log(vector)

		var v = new THREE.Vector3();
	    lwac.getWorldDirection( v )

	    var lwacpos = new THREE.Vector3();
	    lwac.getWorldPosition( lwacpos )
	    console.log(lwacpos)

	    const geometry = new THREE.SphereGeometry( 0.1, 32, 16 );
		const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
		const sphere = new THREE.Mesh( geometry, material );
	    sphere.position.copy( lwacpos );
	    sphere.position.addScaledVector( v, lwac.far )
		scene.add( sphere );

	 //    var fullBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.01), new THREE.MeshLambertMaterial({
	 //      color: "blue"
	 //    }));
	 //    fullBox.rotation.copy( lwac.rotation );
	 //    fullBox.position.copy( lwac.position );
	 //    fullBox.position.addScaledVector( v, 1 )
	 //    scene.add(fullBox)

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