export default new Proxy({}, { get: () => ({ init() {}, main() {}, interrupt: () => false }) });
