function readPackage(pkg) {
  if (pkg.name === 'openapi-typescript' && pkg.version === '7.13.0') {
    delete pkg.peerDependencies?.typescript;
  }

  return pkg;
}

module.exports = { hooks: { readPackage } };
