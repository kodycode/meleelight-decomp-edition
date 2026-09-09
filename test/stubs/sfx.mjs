// Every sounds.<name>.play() is a no-op.
const silent = { play() {}, stop() {}, volume() {} };
export const sounds = new Proxy({}, { get: () => silent });
