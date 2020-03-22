function randomInt() {
	return Math.random() * 0x3FFFFFFF | 0;
}

export {
	randomInt,
};