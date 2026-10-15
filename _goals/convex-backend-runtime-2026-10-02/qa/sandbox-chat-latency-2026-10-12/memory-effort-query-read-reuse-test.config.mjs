import base from '../../../../jest.config.mjs';
export default {...base,rootDir:new URL('../../../../',import.meta.url).pathname,forceExit:false};
