// ============================================
// Matrix & Vector Math Utilities
// ============================================

window.ColorApp = window.ColorApp || {};
window.ColorApp.Matrix = {};

(function(exports) {
    'use strict';

    // Column-major matrix multiplication for WebGL
    function multiplyMatrices(a, b) {
        const result = new Float32Array(16);
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += a[row + k * 4] * b[k + col * 4];
                }
                result[row + col * 4] = sum;
            }
        }
        return result;
    }

    function perspectiveMatrix(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) / (near - far), -1,
            0, 0, (2 * far * near) / (near - far), 0
        ]);
    }

    function rotationXMatrix(angle) {
        const c = Math.cos(angle), s = Math.sin(angle);
        return new Float32Array([
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1
        ]);
    }

    function rotationYMatrix(angle) {
        const c = Math.cos(angle), s = Math.sin(angle);
        return new Float32Array([
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1
        ]);
    }

    function rotationZMatrix(angle) {
        const c = Math.cos(angle), s = Math.sin(angle);
        return new Float32Array([
            c, s, 0, 0,
            -s, c, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    }

    function translationMatrix(x, y, z) {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1
        ]);
    }

    // Vector math helpers
    function vec3Cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    }

    function vec3Normalize(v) {
        const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        if (len === 0) return [0, 0, 0];
        return [v[0] / len, v[1] / len, v[2] / len];
    }

    function vec3Sub(a, b) {
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    }

    function vec3Add(a, b) {
        return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    }

    function vec3Scale(v, s) {
        return [v[0] * s, v[1] * s, v[2] * s];
    }

    function vec3Dot(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    // Export to namespace
    exports.multiplyMatrices = multiplyMatrices;
    exports.perspectiveMatrix = perspectiveMatrix;
    exports.rotationXMatrix = rotationXMatrix;
    exports.rotationYMatrix = rotationYMatrix;
    exports.rotationZMatrix = rotationZMatrix;
    exports.translationMatrix = translationMatrix;
    exports.vec3Cross = vec3Cross;
    exports.vec3Normalize = vec3Normalize;
    exports.vec3Sub = vec3Sub;
    exports.vec3Add = vec3Add;
    exports.vec3Scale = vec3Scale;
    exports.vec3Dot = vec3Dot;

})(window.ColorApp.Matrix);
