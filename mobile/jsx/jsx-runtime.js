// Wraps NativeWind's JSX runtime so legacy hard-coded colours follow dark mode.
const base = require('nativewind/jsx-runtime');
const { mapStyle, mapColor, isDarkNow } = require('./remap');

function patch(props) {
  if (!props || !isDarkNow()) return props;
  let out = props;
  if (props.style) out = { ...out, style: mapStyle(props.style) };
  for (const k of ['color', 'stroke', 'fill', 'placeholderTextColor']) {
    if (typeof props[k] === 'string') { if (out === props) out = { ...out }; out[k] = mapColor(props[k]); }
  }
  return out;
}
exports.Fragment = base.Fragment;
exports.jsx = (t, p, ...r) => base.jsx(t, patch(p), ...r);
exports.jsxs = (t, p, ...r) => base.jsxs(t, patch(p), ...r);
