"use strict";
export const serverOnlyPlugin = {
  name: "convex-server-only",
  setup(build) {
    build.onResolve({ filter: /^server-only$/ }, (args) => ({
      path: args.path,
      namespace: "server-only-stub"
    }));
    build.onLoad({ filter: /.*/, namespace: "server-only-stub" }, () => ({
      contents: "",
      loader: "js"
    }));
  }
};
//# sourceMappingURL=serverOnly.js.map
