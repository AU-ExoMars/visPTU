
// type: 0=range, 1=stride
export function panArrayGenerator(type=0, start=0, stop=0, numPics=2, stride=0){
	let currPan = start, angleArray = [], step, nextPan;

	angleArray.push(currPan);	// start position
	numPics -= 1; 				// used one on start position

	if(type == 0){
		// if set using start,stop

		// if no change in angle, there's only one pan
		if(start == stop) return angleArray;

		if((numPics - 1) > 0) step = (stop - start) / numPics;
		else step = stop - start;
	}
	else if(type == 1){
		// if set using start,stride
		step = stride;
		stop = start + (stride*numPics);
	}

	for(let p = 0; p < numPics; p++) {
		// work out planned next position
		nextPan = currPan + step;
		// apply next angle within bounds and wrap if needed
		if(nextPan >= 185){
			// take whatever is above the bound, add it to the flipped direction
			currPan = -175 + (nextPan - 185);
		}
		else if((currPan + step) <= -185){
			// take whatever is below the bound, add it to the flipped direction
			currPan = 175 - (-185 + nextPan);
		}
		else {
			currPan = nextPan;
		}
		angleArray.push(currPan);	// next position
	};
	return angleArray;
};


