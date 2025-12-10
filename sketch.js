// ----------------------- CONFIG -----------------------
const TOTAL_DURATION_SECONDS = 60;
const CAPTURE_INTERVAL_SECONDS = 5;
const TOTAL_CAPTURES = TOTAL_DURATION_SECONDS / CAPTURE_INTERVAL_SECONDS;

// ----------------------- GLOBALS -----------------------
let capturedData = [];
let state = "WAITING"; // WAITING, CAPTURING, BROWSING
let captureInterval;
let browseIndex = 0;
let lastCaptureTime;
let shutterEffect = 0;

let video;
let mic;
let micLevel = 0;

// interactions
let mousePositions = [];
let clickCount = 0;
let keyPressCount = 0;

// timestamps
let currentTimestamp = "";

// -------------------- Tapestry variables --------------------
let tapestrySrc = null;
let placeholder;

let warpCount = 24;
let weftCount = 32;
let baseSpacing = 32;
let baseThreadW = 6;

let offsetX = 0;
let offsetY = 0;
let targetOffsetX = 0;
let targetOffsetY = 0;

let warpNoise = [];
let weftNoise = [];

// ----------------------- preload -----------------------
function preload() {
    // Placeholder generation moved to setup
}

// ----------------------- setup -----------------------
function setup() {
    createCanvas(windowWidth, windowHeight);
    pixelDensity(1);
    textFont("Times New Roman");

    // Generate placeholder graphics
    placeholder = createGraphics(200, 200);
    placeholder.background(240);
    placeholder.noStroke();
    for (let i = 0; i < 200; i += 10) {
        placeholder.fill(200 - (i % 30));
        placeholder.rect(i, 0, 6, 200);
    }

    // init noise arrays
    for (let i = 0; i < warpCount; i++) warpNoise[i] = random(1000);
    for (let j = 0; j < weftCount; j++) weftNoise[j] = random(1000);

    tapestrySrc = placeholder;

    // Start in a state that waits for interaction
    state = "INITIAL_CLICK";
}

// ----------------------- draw -----------------------
function draw() {
    if (mic) {
        micLevel = lerp(micLevel, mic.getLevel(), 0.1);
    }
    currentTimestamp = new Date().toISOString();

    offsetX += (targetOffsetX - offsetX) * 0.12;
    offsetY += (targetOffsetY - offsetY) * 0.12;

    drawTapestryBackground();

    if (state === "INITIAL_CLICK") {
        drawInitialClickScreen();
    } else if (state === "CAPTURING") {
        mousePositions.push({ x: mouseX, y: mouseY });
        drawCaptureScreen();
    } else if (state === "BROWSING") {
        drawBrowseScreen();
    } else if (state === "WAITING") {
        drawWaitingScreen();
    }

    if (shutterEffect > 0) {
        fill(255, shutterEffect * 25);
        rect(0, 0, width, height);
        shutterEffect--;
    }
}

function drawInitialClickScreen() {
    fill(0, 150);
    rect(0, 0, width, height);

    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);

    if (window.location.protocol === 'file:') {
        fill(255, 100, 100);
        text("WARNING: You are opening this file directly.", width / 2, height / 2 - 40);
        text("Camera/Mic access is BLOCKED by browsers in this mode.", width / 2, height / 2);
        text("Please run a local server (see instructions).", width / 2, height / 2 + 40);
    } else {
        text("Click anywhere to start and allow camera/microphone access", width / 2, height / 2);
    }
}

function initializeMedia() {
    userStartAudio();

    // Webcam
    try {
        video = createCapture(VIDEO, function () {
            console.log("Camera stream started");
        });
        video.size(640, 480);
        video.hide();
    } catch (e) {
        console.error("Webcam access failed:", e);
        alert("Webcam access failed: " + e.message);
    }

    // Microphone
    try {
        mic = new p5.AudioIn();
        mic.start(function () {
            console.log("Microphone started");
        }, function (e) {
            console.error("Microphone start failed", e);
            alert("Microphone access denied or failed. Please check permissions.");
        });
    } catch (e) {
        console.error("Microphone access failed:", e);
        alert("Microphone init failed: " + e.message);
    }

    state = "WAITING";
}

// ----------------------- Tapestry -----------------------
function drawTapestryBackground() {
    background(255);

    let spacing = baseSpacing;
    let threadW = baseThreadW;

    warpCount = max(6, floor(width / spacing));
    weftCount = max(6, floor(height / spacing));

    while (warpNoise.length < warpCount) warpNoise.push(random(1000));
    while (weftNoise.length < weftCount) weftNoise.push(random(1000));

    push();
    translate(offsetX, offsetY);

    let src = tapestrySrc || placeholder;
    try { src.loadPixels(); } catch (e) { }

    let time = frameCount * 0.01;

    // horizontal weft
    for (let j = 0; j < weftCount; j++) {
        let wobY = sin(time * 0.8 + weftNoise[j]) * 6;
        let y = j * spacing + wobY;

        for (let i = 0; i < warpCount; i++) {
            let wobX = cos(time * 0.6 + warpNoise[i]) * 6;
            let x = i * spacing + wobX;
            let c = sampleSourceColor(src, x - offsetX, y - offsetY);
            let bright = (red(c) + green(c) + blue(c)) / 3.0;
            let jitter = map(noise(i * 0.1 + j * 0.05 + time * 0.02), 0, 1, -0.3, 0.3);
            let horizontalOver = bright > 128 + jitter * 30;
            let alpha = horizontalOver ? 230 : 130;

            fill(red(c), green(c), blue(c), alpha);
            rect(x - spacing * 0.6, y - threadW * 0.5, spacing * 1.2, threadW * random(0.8, 1.15));
        }
    }

    // vertical warp
    for (let i = 0; i < warpCount; i++) {
        let wobX = cos(time * 0.6 + warpNoise[i]) * 6;
        let x = i * spacing + wobX;

        for (let j = 0; j < weftCount; j++) {
            let wobY = sin(time * 0.8 + weftNoise[j]) * 6;
            let y = j * spacing + wobY;

            let c = sampleSourceColor(src, x - offsetX, y - offsetY);
            let bright = (red(c) + green(c) + blue(c)) / 3.0;
            let jitter = map(noise(i * 0.1 + j * 0.05 + time * 0.02), 0, 1, -0.3, 0.3);

            let verticalOver = bright <= 128 + jitter * 30;

            if (verticalOver) {
                fill(red(c), green(c), blue(c), 220);
                rect(x - threadW * 0.5, y - spacing * 0.6, threadW * random(0.8, 1.2), spacing * 1.2);
            } else {
                fill(0, 0, 0, 30);
                rect(x - threadW * 0.5, y - spacing * 0.6, threadW * 0.5, spacing * 1.2);
            }
        }
    }

    pop();
    drawGrain();
}

function sampleSourceColor(src, sx, sy) {
    if (!src || !src.pixels) return color(180);

    let scaleFactor = min(width / src.width, height / src.height);
    let sw = src.width * scaleFactor;
    let sh = src.height * scaleFactor;
    let sx0 = (width - sw) / 2;
    let sy0 = (height - sh) / 2;

    let imgX = floor(map(sx, sx0, sx0 + sw, 0, src.width));
    let imgY = floor(map(sy, sy0, sy0 + sh, 0, src.height));

    imgX = constrain(imgX, 0, src.width - 1);
    imgY = constrain(imgY, 0, src.height - 1);

    let idx = (imgY * src.width + imgX) * 4;
    if (idx < 0 || idx + 2 >= src.pixels.length) return color(200);

    return color(src.pixels[idx], src.pixels[idx + 1], src.pixels[idx + 2]);
}

function drawGrain() {
    noStroke();
    for (let i = 0; i < 400; i++) {
        fill(0, random(4, 10));
        rect(random(width), random(height), 1, 1);
    }
}

// ----------------------- UI -----------------------
function drawWaitingScreen() {
    fill(255, 220);
    rectMode(CENTER);
    const s = 400;
    rect(width / 2, height / 2, s + 40, s + 40, 12);
    rectMode(CORNER);

    image(video, (width - s) / 2, (height - s) / 2, s, s);

    fill(0);
    textSize(20);
    textAlign(CENTER, CENTER);
    text("Click to begin the 1-minute documentation.", width / 2, height / 2);
}

function drawCaptureScreen() {
    const latest = capturedData[capturedData.length - 1];
    if (!latest) return;

    drawVisualization(latest);

    let t = (millis() - lastCaptureTime) / 1000;
    let remaining = CAPTURE_INTERVAL_SECONDS - t;

    fill(0);
    textSize(14);
    textAlign(CENTER, CENTER);
    text(
        `Displaying ${capturedData.length} of ${TOTAL_CAPTURES}. Next capture in ${max(0, floor(remaining))}s.`,
        width / 2,
        height - 20
    );
}

function drawBrowseScreen() {
    const dp = capturedData[browseIndex];
    if (!dp) return;
    drawVisualization(dp);

    fill(0);
    textSize(14);
    textAlign(CENTER, CENTER);
    text(
        `Browsing ${browseIndex + 1} of ${TOTAL_CAPTURES}. Click for next.`,
        width / 2,
        height - 20
    );
}

function drawVisualization(data) {
    fill(255, 200);
    const s = 400;
    const x = (width - s) / 2;
    const y = (height - s) / 2;
    rect(x - 20, y - 20, s + 40, s + 120, 10);

    if (data.photo) image(data.photo, x, y, s, s);
    else if (video) image(video, x, y, s, s); // Check if video is initialized

    push();
    translate(x, y);

    // Keypress radials
    stroke(255);
    strokeWeight(2);
    for (let k = 0; k < data.keys; k++) {
        push();
        translate(s / 2, s / 2);
        rotate(k * (PI / 8));
        line(-s / 4, 0, s / 4, 0);
        pop();
    }

    // Mouse circle
    if (data.avgMouseX > 0) {
        let circleSize = map(data.clicks, 0, 10, 20, 100, true);
        fill(255, 0, 0, 150);
        noStroke();

        let mx = map(data.avgMouseX, 0, width, 0, s);
        let my = map(data.avgMouseY, 0, height, 0, s);

        circle(mx, my, circleSize);
    }

    pop();

    fill(0);
    textSize(12);
    textAlign(LEFT, TOP);
    text(
        `MIC: ${nf(data.mic, 1, 3)}
TIME: ${data.timestamp}`, 20, 20
    );
}

// ----------------------- interaction -----------------------
function mousePressed() {
    if (state === "INITIAL_CLICK") {
        initializeMedia();
        return;
    }

    if (state !== "CAPTURING" || capturedData.length > 0) clickCount++;

    if (state === "WAITING") startDocumentation();
    else if (state === "BROWSING") browseIndex = (browseIndex + 1) % capturedData.length;
}

function keyPressed() {
    if (state === "CAPTURING") keyPressCount++;
    return false;
}

function touchMoved() {
    targetOffsetX += (mouseX - pmouseX);
    targetOffsetY += (mouseY - pmouseY);
    return false;
}

function startDocumentation() {
    state = "CAPTURING";
    clickCount = 0;
    keyPressCount = 0;

    captureData();
    captureInterval = setInterval(captureData, CAPTURE_INTERVAL_SECONDS * 1000);
}

function captureData() {
    if (capturedData.length >= TOTAL_CAPTURES) {
        clearInterval(captureInterval);
        state = "BROWSING";
        return;
    }

    shutterEffect = 10;
    lastCaptureTime = millis();

    let avgX = 0, avgY = 0;
    if (mousePositions.length) {
        let tX = 0, tY = 0;
        for (let p of mousePositions) {
            tX += p.x; tY += p.y;
        }
        avgX = tX / mousePositions.length;
        avgY = tY / mousePositions.length;
    }

    let photo = video.get();
    try { photo.loadPixels(); } catch (e) { }

    tapestrySrc = photo;

    capturedData.push({
        image: capturedData.length,
        timestamp: currentTimestamp,
        photo: photo,
        avgMouseX: avgX,
        avgMouseY: avgY,
        clicks: clickCount,
        keys: keyPressCount,
        mic: micLevel
    });

    mousePositions = [];
    clickCount = 0;
    keyPressCount = 0;
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
