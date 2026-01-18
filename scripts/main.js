// ============================================
// Main Application Entry Point
// ============================================

(function() {
    'use strict';

    // Shorthand references to namespace modules
    var Color = window.ColorApp.Color;
    var Wheel = window.ColorApp.Wheel;
    var Cube = window.ColorApp.Cube;
    var Cylinder = window.ColorApp.Cylinder;

    // ============================================
    // DOM Elements
    // ============================================

    var rgbCanvas = document.getElementById('rgbCanvas');
    var hsvCanvas = document.getElementById('hsvCanvas');
    var cubeCanvas = document.getElementById('cubeCanvas');
    var cylinderCanvas = document.getElementById('cylinderCanvas');

    var tSlider = document.getElementById('tSlider');
    var tValueDisplay = document.getElementById('tValue');

    var swatchA = document.getElementById('swatchA');
    var swatchB = document.getElementById('swatchB');
    var rgbADisplay = document.getElementById('rgbA');
    var rgbBDisplay = document.getElementById('rgbB');
    var hsvADisplay = document.getElementById('hsvA');
    var hsvBDisplay = document.getElementById('hsvB');

    var rgbBlendSwatch = document.getElementById('rgbBlendSwatch');
    var hsvBlendSwatch = document.getElementById('hsvBlendSwatch');
    var rgbBlendRgb = document.getElementById('rgbBlendRgb');
    var rgbBlendHsv = document.getElementById('rgbBlendHsv');
    var hsvBlendRgb = document.getElementById('hsvBlendRgb');
    var hsvBlendHsv = document.getElementById('hsvBlendHsv');

    // ============================================
    // Application State
    // ============================================

    var colorA = [255, 0, 0];
    var colorB = [0, 255, 255];
    var t = parseFloat(tSlider.value);

    var hueDirection = 'shortest';
    var spiralRevolutions = 1;

    var draggingDot = null;
    var activeCanvas = null;

    // Cube state
    var cubeRotationX = 2.66;
    var cubeRotationY = -3.14;
    var cubeRotationZ = 0;
    var cubeZoom = 2.33;
    var ZOOM_MIN = 2.0;
    var ZOOM_MAX = 8.0;
    var isDraggingCube = false;
    var lastCubeMouseX, lastCubeMouseY;
    var lastPinchDistance = 0;

    // Cylinder state
    var cylinderRotationX = 0.618;
    var cylinderRotationY = 0;
    var cylinderRotationZ = 0;
    var cylinderZoom = 2.1;
    var isDraggingCylinder = false;
    var lastCylinderMouseX, lastCylinderMouseY;
    var lastCylinderPinchDistance = 0;

    // ============================================
    // Initialize WebGL Contexts
    // ============================================

    var rgbCtx = Wheel.createWheelContext(rgbCanvas, 0);
    var hsvCtx = Wheel.createWheelContext(hsvCanvas, 1);
    Cube.initCube(cubeCanvas);
    Cylinder.initCylinder(cylinderCanvas);

    // ============================================
    // Update Function
    // ============================================

    function update() {
        Wheel.renderWheel(rgbCtx, colorA, colorB, t, hueDirection, spiralRevolutions);
        Wheel.renderWheel(hsvCtx, colorA, colorB, t, hueDirection, spiralRevolutions);

        var rgbResult = Color.lerpRGB(colorA, colorB, t);
        var hsvResult = Color.lerpHSV(colorA, colorB, t, hueDirection, spiralRevolutions);

        rgbBlendSwatch.style.backgroundColor = Color.rgbToCss(rgbResult);
        hsvBlendSwatch.style.backgroundColor = Color.rgbToCss(hsvResult);
        rgbBlendRgb.textContent = Color.rgbToCss(rgbResult);
        rgbBlendHsv.textContent = Color.hsvToCss(rgbResult);
        hsvBlendRgb.textContent = Color.rgbToCss(hsvResult);
        hsvBlendHsv.textContent = Color.hsvToCss(hsvResult);

        swatchA.style.backgroundColor = Color.rgbToCss(colorA);
        swatchB.style.backgroundColor = Color.rgbToCss(colorB);
        rgbADisplay.textContent = Color.rgbToCss(colorA);
        rgbBDisplay.textContent = Color.rgbToCss(colorB);
        hsvADisplay.textContent = Color.hsvToCss(colorA);
        hsvBDisplay.textContent = Color.hsvToCss(colorB);

        tValueDisplay.textContent = t.toFixed(2);

        Cube.renderCube(cubeCanvas, rgbCanvas, colorA, colorB, t, cubeRotationX, cubeRotationY, cubeRotationZ, cubeZoom);
        Cylinder.renderCylinder(cylinderCanvas, rgbCanvas, colorA, colorB, t, hueDirection, spiralRevolutions, cylinderRotationX, cylinderRotationY, cylinderRotationZ, cylinderZoom);
    }

    // ============================================
    // Interaction Helpers
    // ============================================

    function getClientCoords(event) {
        if (event.touches && event.touches.length > 0) {
            return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
        }
        return { clientX: event.clientX, clientY: event.clientY };
    }

    function getColorFromCanvas(canvas, event) {
        var coords = getClientCoords(event);
        var rect = canvas.getBoundingClientRect();
        var x = ((coords.clientX - rect.left) / rect.width) * 2 - 1;
        var y = -(((coords.clientY - rect.top) / rect.height) * 2 - 1);

        var dist = Math.sqrt(x * x + y * y);
        if (dist > Wheel.WHEEL_SCALE) return null;

        var hue = 0.25 - Math.atan2(y, x) / (2 * Math.PI);
        if (hue < 0) hue += 1;
        if (hue >= 1) hue -= 1;
        var sat = Math.min(dist / Wheel.WHEEL_SCALE, 1);

        return Color.hsv2rgb(hue, sat, 1);
    }

    function getDotPositions(mode) {
        var hsvA_val = Color.rgb2hsv(colorA[0], colorA[1], colorA[2]);
        var hsvB_val = Color.rgb2hsv(colorB[0], colorB[1], colorB[2]);
        var hA = hsvA_val[0], sA = hsvA_val[1];
        var hB = hsvB_val[0], sB = hsvB_val[1];

        var angleA = (0.25 - hA) * 2 * Math.PI;
        var posA = {
            x: Math.cos(angleA) * sA * Wheel.WHEEL_SCALE,
            y: Math.sin(angleA) * sA * Wheel.WHEEL_SCALE
        };

        var angleB = (0.25 - hB) * 2 * Math.PI;
        var posB = {
            x: Math.cos(angleB) * sB * Wheel.WHEEL_SCALE,
            y: Math.sin(angleB) * sB * Wheel.WHEEL_SCALE
        };

        var posT;
        if (mode === 0) {
            posT = {
                x: posA.x + (posB.x - posA.x) * t,
                y: posA.y + (posB.y - posA.y) * t
            };
        } else {
            var hueA = hA;
            var hueB = hB;

            if (hueDirection === 'shortest') {
                var hueDiff = hueB - hueA;
                if (hueDiff > 0.5) hueA += 1;
                else if (hueDiff < -0.5) hueB += 1;
            } else if (hueDirection === 'clockwise') {
                if (hueB <= hueA) hueB += 1;
            } else if (hueDirection === 'counter') {
                if (hueB >= hueA) hueA += 1;
            } else if (hueDirection === 'spiralCW') {
                if (hueB <= hueA) hueB += 1;
                hueB += spiralRevolutions;
            } else if (hueDirection === 'spiralCCW') {
                if (hueB >= hueA) hueA += 1;
                hueA += spiralRevolutions;
            }

            var h = ((hueA + (hueB - hueA) * t) % 1 + 1) % 1;
            var s = sA + (sB - sA) * t;
            var angleT = (0.25 - h) * 2 * Math.PI;
            posT = {
                x: Math.cos(angleT) * s * Wheel.WHEEL_SCALE,
                y: Math.sin(angleT) * s * Wheel.WHEEL_SCALE
            };
        }

        return { posA: posA, posB: posB, posT: posT, hA: hA, sA: sA, hB: hB, sB: sB };
    }

    function checkDotClick(canvas, event) {
        var coords = getClientCoords(event);
        var rect = canvas.getBoundingClientRect();
        var x = ((coords.clientX - rect.left) / rect.width) * 2 - 1;
        var y = -(((coords.clientY - rect.top) / rect.height) * 2 - 1);

        var mode = canvas === rgbCanvas ? 0 : 1;
        var positions = getDotPositions(mode);

        var distA = Math.sqrt(Math.pow(x - positions.posA.x, 2) + Math.pow(y - positions.posA.y, 2));
        var distB = Math.sqrt(Math.pow(x - positions.posB.x, 2) + Math.pow(y - positions.posB.y, 2));
        var distT = Math.sqrt(Math.pow(x - positions.posT.x, 2) + Math.pow(y - positions.posT.y, 2));

        var dotRadius = 0.18;
        var dotRadiusT = 0.19;

        if (distT <= dotRadiusT) {
            return 'T';
        } else if (distA <= dotRadius && distA <= distB) {
            return 'A';
        } else if (distB <= dotRadius) {
            return 'B';
        }

        return null;
    }

    function getTFromPosition(canvas, event) {
        var coords = getClientCoords(event);
        var rect = canvas.getBoundingClientRect();
        var x = ((coords.clientX - rect.left) / rect.width) * 2 - 1;
        var y = -(((coords.clientY - rect.top) / rect.height) * 2 - 1);

        var mode = canvas === rgbCanvas ? 0 : 1;
        var positions = getDotPositions(mode);

        if (mode === 0) {
            var abX = positions.posB.x - positions.posA.x;
            var abY = positions.posB.y - positions.posA.y;
            var len = Math.sqrt(abX * abX + abY * abY);
            if (len === 0) return t;

            var apX = x - positions.posA.x;
            var apY = y - positions.posA.y;
            var proj = (apX * abX + apY * abY) / (len * len);
            return Math.max(0, Math.min(1, proj));
        } else {
            var hueA = positions.hA;
            var hueB = positions.hB;

            if (hueDirection === 'shortest') {
                var hueDiff = hueB - hueA;
                if (hueDiff > 0.5) hueA += 1;
                else if (hueDiff < -0.5) hueB += 1;
            } else if (hueDirection === 'clockwise') {
                if (hueB <= hueA) hueB += 1;
            } else if (hueDirection === 'counter') {
                if (hueB >= hueA) hueA += 1;
            } else if (hueDirection === 'spiralCW') {
                if (hueB <= hueA) hueB += 1;
                hueB += spiralRevolutions;
            } else if (hueDirection === 'spiralCCW') {
                if (hueB >= hueA) hueA += 1;
                hueA += spiralRevolutions;
            }

            var pointHue = 0.25 - Math.atan2(y, x) / (2 * Math.PI);
            if (pointHue < 0) pointHue += 1;
            if (pointHue >= 1) pointHue -= 1;

            var minH = Math.min(hueA, hueB);
            var maxH = Math.max(hueA, hueB);

            var newT = null;
            var totalRevs = Math.ceil(maxH - minH);
            for (var wrap = 0; wrap <= totalRevs && newT === null; wrap++) {
                var testHue = pointHue + wrap;
                if (testHue >= minH && testHue <= maxH) {
                    newT = (testHue - minH) / (maxH - minH);
                }
            }

            if (newT === null) return t;

            if (hueA > hueB) newT = 1 - newT;
            return Math.max(0, Math.min(1, newT));
        }
    }

    // ============================================
    // Color Wheel Event Handlers
    // ============================================

    function handleDragStart(canvas, e) {
        var clicked = checkDotClick(canvas, e);

        if (clicked) {
            draggingDot = clicked;
            activeCanvas = canvas;
            canvas.style.cursor = 'grabbing';

            if (draggingDot === 'T') {
                t = getTFromPosition(canvas, e);
                tSlider.value = t;
                update();
            } else {
                var newColor = getColorFromCanvas(canvas, e);
                if (newColor) {
                    if (draggingDot === 'A') {
                        colorA = newColor;
                    } else {
                        colorB = newColor;
                    }
                    update();
                }
            }
        }
    }

    function handleDragMove(e) {
        if (draggingDot && activeCanvas) {
            if (draggingDot === 'T') {
                t = getTFromPosition(activeCanvas, e);
                tSlider.value = t;
                update();
            } else {
                var newColor = getColorFromCanvas(activeCanvas, e);
                if (newColor) {
                    if (draggingDot === 'A') {
                        colorA = newColor;
                    } else {
                        colorB = newColor;
                    }
                    update();
                }
            }
        }
    }

    function handleDragEnd() {
        if (draggingDot) {
            draggingDot = null;
            activeCanvas = null;
            rgbCanvas.style.cursor = 'default';
            hsvCanvas.style.cursor = 'default';
        }
    }

    function setupCanvasInteraction(canvas) {
        canvas.addEventListener('mousedown', function(e) { handleDragStart(canvas, e); });

        canvas.addEventListener('mousemove', function(e) {
            if (!draggingDot) {
                var hovering = checkDotClick(canvas, e);
                canvas.style.cursor = hovering ? 'grab' : 'default';
            }
        });

        canvas.addEventListener('touchstart', function(e) {
            handleDragStart(canvas, e);
            if (draggingDot) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    setupCanvasInteraction(rgbCanvas);
    setupCanvasInteraction(hsvCanvas);

    hsvCanvas.addEventListener('wheel', function(e) {
        if (hueDirection === 'spiralCW' || hueDirection === 'spiralCCW') {
            e.preventDefault();
            var delta = e.deltaY > 0 ? -1 : 1;
            spiralRevolutions = Math.max(0, Math.min(3, spiralRevolutions + delta));
            update();
        }
    }, { passive: false });

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    document.addEventListener('touchmove', function(e) {
        if (draggingDot) {
            e.preventDefault();
            handleDragMove(e);
        }
    }, { passive: false });

    document.addEventListener('touchend', handleDragEnd);
    document.addEventListener('touchcancel', handleDragEnd);

    // ============================================
    // Cube Event Handlers
    // ============================================

    function getPinchDistance(touches) {
        var dx = touches[0].clientX - touches[1].clientX;
        var dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    cubeCanvas.addEventListener('mousedown', function(e) {
        isDraggingCube = true;
        lastCubeMouseX = e.clientX;
        lastCubeMouseY = e.clientY;
        cubeCanvas.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function(e) {
        if (isDraggingCube) {
            var dx = e.clientX - lastCubeMouseX;
            var dy = e.clientY - lastCubeMouseY;
            cubeRotationY += dx * 0.01;
            cubeRotationX += dy * 0.01;
            lastCubeMouseX = e.clientX;
            lastCubeMouseY = e.clientY;
            document.getElementById('cubeRotX').value = cubeRotationX;
            document.getElementById('cubeRotY').value = cubeRotationY;
            Cube.renderCube(cubeCanvas, rgbCanvas, colorA, colorB, t, cubeRotationX, cubeRotationY, cubeRotationZ, cubeZoom);
        }
    });

    document.addEventListener('mouseup', function() {
        isDraggingCube = false;
        cubeCanvas.style.cursor = 'grab';
    });

    cubeCanvas.addEventListener('wheel', function(e) {
        e.preventDefault();
        var zoomSpeed = 0.001;
        cubeZoom += e.deltaY * zoomSpeed * cubeZoom;
        cubeZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cubeZoom));
        Cube.renderCube(cubeCanvas, rgbCanvas, colorA, colorB, t, cubeRotationX, cubeRotationY, cubeRotationZ, cubeZoom);
    }, { passive: false });

    cubeCanvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            isDraggingCube = true;
            lastCubeMouseX = e.touches[0].clientX;
            lastCubeMouseY = e.touches[0].clientY;
            e.preventDefault();
        } else if (e.touches.length === 2) {
            isDraggingCube = false;
            lastPinchDistance = getPinchDistance(e.touches);
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1 && isDraggingCube) {
            var dx = e.touches[0].clientX - lastCubeMouseX;
            var dy = e.touches[0].clientY - lastCubeMouseY;
            cubeRotationY += dx * 0.01;
            cubeRotationX += dy * 0.01;
            lastCubeMouseX = e.touches[0].clientX;
            lastCubeMouseY = e.touches[0].clientY;
            document.getElementById('cubeRotX').value = cubeRotationX;
            document.getElementById('cubeRotY').value = cubeRotationY;
            Cube.renderCube(cubeCanvas, rgbCanvas, colorA, colorB, t, cubeRotationX, cubeRotationY, cubeRotationZ, cubeZoom);
        } else if (e.touches.length === 2 && lastPinchDistance > 0) {
            var currentDistance = getPinchDistance(e.touches);
            var delta = lastPinchDistance - currentDistance;
            var zoomSpeed = 0.02;
            cubeZoom += delta * zoomSpeed;
            cubeZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cubeZoom));
            lastPinchDistance = currentDistance;
            Cube.renderCube(cubeCanvas, rgbCanvas, colorA, colorB, t, cubeRotationX, cubeRotationY, cubeRotationZ, cubeZoom);
        }
    }, { passive: false });

    document.addEventListener('touchend', function(e) {
        if (e.touches.length < 2) {
            lastPinchDistance = 0;
        }
        if (e.touches.length === 0) {
            isDraggingCube = false;
        }
    });

    // ============================================
    // Cylinder Event Handlers
    // ============================================

    cylinderCanvas.addEventListener('mousedown', function(e) {
        isDraggingCylinder = true;
        lastCylinderMouseX = e.clientX;
        lastCylinderMouseY = e.clientY;
        cylinderCanvas.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function(e) {
        if (isDraggingCylinder) {
            var dx = e.clientX - lastCylinderMouseX;
            var dy = e.clientY - lastCylinderMouseY;
            cylinderRotationY += dx * 0.01;
            cylinderRotationX += dy * 0.01;
            lastCylinderMouseX = e.clientX;
            lastCylinderMouseY = e.clientY;
            document.getElementById('cylinderRotX').value = cylinderRotationX;
            document.getElementById('cylinderRotY').value = cylinderRotationY;
            Cylinder.renderCylinder(cylinderCanvas, rgbCanvas, colorA, colorB, t, hueDirection, spiralRevolutions, cylinderRotationX, cylinderRotationY, cylinderRotationZ, cylinderZoom);
        }
    });

    document.addEventListener('mouseup', function() {
        if (isDraggingCylinder) {
            isDraggingCylinder = false;
            cylinderCanvas.style.cursor = 'grab';
        }
    });

    cylinderCanvas.addEventListener('wheel', function(e) {
        e.preventDefault();
        var zoomSpeed = 0.001;
        cylinderZoom += e.deltaY * zoomSpeed * cylinderZoom;
        cylinderZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cylinderZoom));
        Cylinder.renderCylinder(cylinderCanvas, rgbCanvas, colorA, colorB, t, hueDirection, spiralRevolutions, cylinderRotationX, cylinderRotationY, cylinderRotationZ, cylinderZoom);
    }, { passive: false });

    cylinderCanvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            isDraggingCylinder = true;
            lastCylinderMouseX = e.touches[0].clientX;
            lastCylinderMouseY = e.touches[0].clientY;
            e.preventDefault();
        } else if (e.touches.length === 2) {
            isDraggingCylinder = false;
            lastCylinderPinchDistance = getPinchDistance(e.touches);
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1 && isDraggingCylinder) {
            var dx = e.touches[0].clientX - lastCylinderMouseX;
            var dy = e.touches[0].clientY - lastCylinderMouseY;
            cylinderRotationY += dx * 0.01;
            cylinderRotationX += dy * 0.01;
            lastCylinderMouseX = e.touches[0].clientX;
            lastCylinderMouseY = e.touches[0].clientY;
            document.getElementById('cylinderRotX').value = cylinderRotationX;
            document.getElementById('cylinderRotY').value = cylinderRotationY;
            Cylinder.renderCylinder(cylinderCanvas, rgbCanvas, colorA, colorB, t, hueDirection, spiralRevolutions, cylinderRotationX, cylinderRotationY, cylinderRotationZ, cylinderZoom);
        } else if (e.touches.length === 2 && lastCylinderPinchDistance > 0) {
            var currentDistance = getPinchDistance(e.touches);
            var delta = lastCylinderPinchDistance - currentDistance;
            var zoomSpeed = 0.02;
            cylinderZoom += delta * zoomSpeed;
            cylinderZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cylinderZoom));
            lastCylinderPinchDistance = currentDistance;
            Cylinder.renderCylinder(cylinderCanvas, rgbCanvas, colorA, colorB, t, hueDirection, spiralRevolutions, cylinderRotationX, cylinderRotationY, cylinderRotationZ, cylinderZoom);
        }
    }, { passive: false });

    document.addEventListener('touchend', function(e) {
        if (e.touches.length < 2) {
            lastCylinderPinchDistance = 0;
        }
        if (e.touches.length === 0) {
            isDraggingCylinder = false;
        }
    });

    // ============================================
    // UI Control Event Handlers
    // ============================================

    tSlider.addEventListener('input', function(e) {
        t = parseFloat(e.target.value);
        update();
    });

    document.querySelectorAll('input[name="hueDirection"]').forEach(function(radio) {
        radio.addEventListener('change', function(e) {
            hueDirection = e.target.value;
            update();
        });
    });

    var hueSettingsBtn = document.getElementById('hueSettingsBtn');
    var hueSettingsMenu = document.getElementById('hueSettingsMenu');

    hueSettingsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        hueSettingsMenu.classList.toggle('open');
        hueSettingsBtn.classList.toggle('active');
    });

    document.addEventListener('click', function(e) {
        if (!hueSettingsMenu.contains(e.target) && !hueSettingsBtn.contains(e.target)) {
            hueSettingsMenu.classList.remove('open');
            hueSettingsBtn.classList.remove('active');
        }
    });

    window.addEventListener('resize', function() {
        update();
    });

    function updateHeader() {
        var header = document.querySelector('.header');
        var isScrolled = document.body.scrollTop > 50 || document.documentElement.scrollTop > 50;
        header.classList.toggle('scrolled', isScrolled);
    }

    window.addEventListener('scroll', updateHeader);

    document.getElementById('cubeRotX').addEventListener('input', function(e) {
        cubeRotationX = parseFloat(e.target.value);
        Cube.renderCube(cubeCanvas, rgbCanvas, colorA, colorB, t, cubeRotationX, cubeRotationY, cubeRotationZ, cubeZoom);
    });
    document.getElementById('cubeRotY').addEventListener('input', function(e) {
        cubeRotationY = parseFloat(e.target.value);
        Cube.renderCube(cubeCanvas, rgbCanvas, colorA, colorB, t, cubeRotationX, cubeRotationY, cubeRotationZ, cubeZoom);
    });
    document.getElementById('cubeRotZ').addEventListener('input', function(e) {
        cubeRotationZ = parseFloat(e.target.value);
        Cube.renderCube(cubeCanvas, rgbCanvas, colorA, colorB, t, cubeRotationX, cubeRotationY, cubeRotationZ, cubeZoom);
    });

    document.getElementById('cylinderRotX').addEventListener('input', function(e) {
        cylinderRotationX = parseFloat(e.target.value);
        Cylinder.renderCylinder(cylinderCanvas, rgbCanvas, colorA, colorB, t, hueDirection, spiralRevolutions, cylinderRotationX, cylinderRotationY, cylinderRotationZ, cylinderZoom);
    });
    document.getElementById('cylinderRotY').addEventListener('input', function(e) {
        cylinderRotationY = parseFloat(e.target.value);
        Cylinder.renderCylinder(cylinderCanvas, rgbCanvas, colorA, colorB, t, hueDirection, spiralRevolutions, cylinderRotationX, cylinderRotationY, cylinderRotationZ, cylinderZoom);
    });
    document.getElementById('cylinderRotZ').addEventListener('input', function(e) {
        cylinderRotationZ = parseFloat(e.target.value);
        Cylinder.renderCylinder(cylinderCanvas, rgbCanvas, colorA, colorB, t, hueDirection, spiralRevolutions, cylinderRotationX, cylinderRotationY, cylinderRotationZ, cylinderZoom);
    });

    // ============================================
    // Initial Render
    // ============================================

    update();
    updateHeader();

})();
