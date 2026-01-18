// ============================================
// Color Space Conversion & Interpolation
// ============================================

// Create global namespace
window.ColorApp = window.ColorApp || {};
window.ColorApp.Color = {};

(function(exports) {
    'use strict';

    function rgb2hsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        let h, s, v = max;

        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [h, s, v];
    }

    function hsv2rgb(h, s, v) {
        let r, g, b;

        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function lerpRGB(colorA, colorB, t) {
        return [
            Math.round(lerp(colorA[0], colorB[0], t)),
            Math.round(lerp(colorA[1], colorB[1], t)),
            Math.round(lerp(colorA[2], colorB[2], t))
        ];
    }

    function lerpHSV(colorA, colorB, t, hueDirection, spiralRevolutions) {
        hueDirection = hueDirection || 'shortest';
        spiralRevolutions = spiralRevolutions || 1;

        const hsvA = rgb2hsv(colorA[0], colorA[1], colorA[2]);
        const hsvB = rgb2hsv(colorB[0], colorB[1], colorB[2]);

        let hueA = hsvA[0];
        let hueB = hsvB[0];

        if (hueDirection === 'shortest') {
            const hueDiff = hueB - hueA;
            if (Math.abs(hueDiff) > 0.5) {
                if (hueDiff > 0) {
                    hueA += 1;
                } else {
                    hueB += 1;
                }
            }
        } else if (hueDirection === 'clockwise') {
            if (hueB <= hueA) {
                hueB += 1;
            }
        } else if (hueDirection === 'counter') {
            if (hueB >= hueA) {
                hueA += 1;
            }
        } else if (hueDirection === 'spiralCW') {
            if (hueB <= hueA) {
                hueB += 1;
            }
            hueB += spiralRevolutions;
        } else if (hueDirection === 'spiralCCW') {
            if (hueB >= hueA) {
                hueA += 1;
            }
            hueA += spiralRevolutions;
        }

        let h = lerp(hueA, hueB, t) % 1;
        if (h < 0) h += 1;

        const s = lerp(hsvA[1], hsvB[1], t);
        const v = lerp(hsvA[2], hsvB[2], t);

        return hsv2rgb(h, s, v);
    }

    function rgbToHex(rgb) {
        const toHex = (n) => {
            const hex = Math.round(n).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
    }

    function rgbToCss(rgb) {
        const r = String(rgb[0]).padStart(3, ' ');
        const g = String(rgb[1]).padStart(3, ' ');
        const b = String(rgb[2]).padStart(3, ' ');
        return `rgb(${r}, ${g}, ${b})`;
    }

    function hsvToCss(rgb) {
        const [h, s, v] = rgb2hsv(rgb[0], rgb[1], rgb[2]);
        const hPad = String(Math.round(h * 255)).padStart(3, ' ');
        const sPad = String(Math.round(s * 255)).padStart(3, ' ');
        const vPad = String(Math.round(v * 255)).padStart(3, ' ');
        return `hsv(${hPad}, ${sPad}, ${vPad})`;
    }

    // Export to namespace
    exports.rgb2hsv = rgb2hsv;
    exports.hsv2rgb = hsv2rgb;
    exports.lerp = lerp;
    exports.lerpRGB = lerpRGB;
    exports.lerpHSV = lerpHSV;
    exports.rgbToHex = rgbToHex;
    exports.rgbToCss = rgbToCss;
    exports.hsvToCss = hsvToCss;

})(window.ColorApp.Color);
