const buble = require('rollup-plugin-buble');
const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');

const plugins = [
  buble({
    jsx: 'h',
    objectAssign: 'Object.assign',
  }),
  commonjs({include: 'node_modules/**'}),
  nodeResolve(),
];

module.exports = [{
  entry: 'src/index.js',
  dest: 'dist/moodle-concept-map.js',
  plugins: plugins,
}];

