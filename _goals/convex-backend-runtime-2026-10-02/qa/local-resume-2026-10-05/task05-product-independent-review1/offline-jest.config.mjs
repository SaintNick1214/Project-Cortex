import original from '../../../../../jest.config.mjs';
const root = new URL('../../../../../', import.meta.url).pathname;
export default { ...original, rootDir: root, roots: [root + 'tests', new URL('.', import.meta.url).pathname], setupFiles: [], setupFilesAfterEnv: [], reporters: ['default'], cache: false };
