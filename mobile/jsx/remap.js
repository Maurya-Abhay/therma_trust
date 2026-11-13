"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapColor = exports.isDarkNow = exports.setDark = void 0;
exports.mapStyle = mapStyle;
// Dark-mode colour mapper for hard-coded hex colours (used by jsx runtime).
let dark = false;
const setDark = (v) => { dark = v; };
exports.setDark = setDark;
const isDarkNow = () => dark;
exports.isDarkNow = isDarkNow;
const cache = new Map();
const COLOR_KEYS = new Set(['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor']);
function hsl(hex) {
    const n = parseInt(hex.slice(1, 7), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (!d)
        return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
}
function toHex(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}
function map(key, v) {
    if (!/^#[0-9a-f]{6}$/i.test(v))
        return v;
    const id = key + v;
    const hit = cache.get(id);
    if (hit)
        return hit;
    const [h, s, l] = hsl(v);
    let out = v;
    if (key === 'color') {
        if (l < 0.45)
            out = toHex(h, Math.min(s, 0.75), Math.min(0.95, 1.02 - l));
        else if (l < 0.7)
            out = toHex(h, s, Math.min(0.75, l + 0.18));
    }
    else if (key === 'backgroundColor') {
        if (l > 0.985)
            out = '#132238';
        else if (l > 0.94 && s < 0.4)
            out = '#0A1424';
        else if (l > 0.8)
            out = toHex(h, Math.min(s, 0.35), 0.17);
    }
    else if (l > 0.8)
        out = '#223652';
    cache.set(id, out);
    return out;
}
const seen = new WeakMap();
function mapStyle(style) {
    if (!dark || !style)
        return style;
    if (Array.isArray(style))
        return style.map(mapStyle);
    if (typeof style !== 'object')
        return style;
    const hit = seen.get(style);
    if (hit)
        return hit;
    let out = style;
    for (const k in style) {
        const v = style[k];
        if (COLOR_KEYS.has(k) && typeof v === 'string') {
            const m = map(k === 'color' ? 'color' : k === 'backgroundColor' ? k : 'border', v);
            if (m !== v) {
                if (out === style)
                    out = { ...style };
                out[k] = m;
            }
        }
    }
    seen.set(style, out);
    return out;
}
const mapColor = (v) => (dark && typeof v === 'string' ? map('color', v) : v);
exports.mapColor = mapColor;
