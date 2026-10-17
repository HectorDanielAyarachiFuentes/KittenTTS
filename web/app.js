// KittenTTS Studio Client Application

let appInfo = null;
let currentAudio = document.getElementById("mainAudio");
let audioContext = null;
let analyser = null;
let sourceNode = null;
let isVisualizerInit = false;
let animationId = null;

// Grabación de Micrófono
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let recordStartTime = 0;
let recordTimerInterval = null;

// Elementos del DOM
const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const modelSelect = document.getElementById("modelSelect");
const voiceSelect = document.getElementById("voiceSelect");
const presetGroup = document.getElementById("presetGroup");
const presetSelect = document.getElementById("presetSelect");
const speedGroup = document.getElementById("speedGroup");
const speedRange = document.getElementById("speedRange");
const speedVal = document.getElementById("speedVal");
const expressionToolbar = document.getElementById("expressionToolbar");
const emotionsContainer = document.getElementById("emotionsContainer");
const eventsContainer = document.getElementById("eventsContainer");
const ttsTextInput = document.getElementById("ttsTextInput");
const btnGenerate = document.getElementById("btnGenerate");

// Grabación y Clonación
const btnRecordMic = document.getElementById("btnRecordMic");
const recordLabel = document.getElementById("recordLabel");
const recordTimer = document.getElementById("recordTimer");
const dropZone = document.getElementById("dropZone");
const audioFileInput = document.getElementById("audioFileInput");
const fileNameLabel = document.getElementById("fileNameLabel");
const previewSourceContainer = document.getElementById("previewSourceContainer");
const previewSourceAudio = document.getElementById("previewSourceAudio");
const cloneTextInput = document.getElementById("cloneTextInput");
const referenceTextInput = document.getElementById("referenceTextInput");
const btnClone = document.getElementById("btnClone");

// Reproductor
const playerCard = document.getElementById("playerCard");
const playerModelBadge = document.getElementById("playerModelBadge");
const playerVoiceBadge = document.getElementById("playerVoiceBadge");
const playerTimeBadge = document.getElementById("playerTimeBadge");
const playerTextPreview = document.getElementById("playerTextPreview");
const btnPlayPause = document.getElementById("btnPlayPause");
const playIcon = document.getElementById("playIcon");
const progressBarContainer = document.getElementById("progressBarContainer");
const progressBar = document.getElementById("progressBar");
const audioTimeLabel = document.getElementById("audioTimeLabel");
const btnDownload = document.getElementById("btnDownload");
const waveformCanvas = document.getElementById("waveformCanvas");
const canvasCtx = waveformCanvas.getContext("2d");

// Overlay de Carga
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingTitle = document.getElementById("loadingTitle");
const loadingSubtitle = document.getElementById("loadingSubtitle");
const elapsedSeconds = document.getElementById("elapsedSeconds");
let elapsedInterval = null;

// Inicialización
document.addEventListener("DOMContentLoaded", async () => {
    setupTabs();
    setupExamples();
    setupAudioPlayer();
    setupCloning();
    await fetchInfo();
    renderHistory();
});

// Navegación por pestañas
function setupTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabPanels.forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            const target = document.getElementById(`tab-${btn.dataset.tab}`);
            if (target) target.classList.add("active");
        });
    });
}

// Cargar información del backend
async function fetchInfo() {
    try {
        const res = await fetch("/api/info");
        appInfo = await res.json();
        document.getElementById("backendStatus").textContent = "Motor listo y en línea";
        populateVoices();
        populateExpressions();
    } catch (err) {
        console.error("Error al conectar con la API:", err);
        document.getElementById("backendStatus").textContent = "Sin conexión al servidor";
    }
}

// Llenar selector de voces según modelo
function populateVoices() {
    if (!appInfo) return;
    const isKitten2 = modelSelect.value === "kitten2";
    voiceSelect.innerHTML = "";

    if (isKitten2) {
        presetGroup.style.display = "flex";
        speedGroup.style.display = "none";
        expressionToolbar.style.display = "flex";

        for (const [groupName, voices] of Object.entries(appInfo.kitten2_voices)) {
            const optgroup = document.createElement("optgroup");
            optgroup.label = groupName;
            voices.forEach(v => {
                const opt = document.createElement("option");
                opt.value = v;
                opt.textContent = v;
                if (v === "Spanish") opt.selected = true;
                optgroup.appendChild(opt);
            });
            voiceSelect.appendChild(optgroup);
        }
    } else {
        presetGroup.style.display = "none";
        speedGroup.style.display = "flex";
        expressionToolbar.style.display = "none";

        const optgroup = document.createElement("optgroup");
        optgroup.label = "Voces Ligeras ONNX (Pronunciación en Español - 1 a 2 segundos)";
        appInfo.onnx_voices.forEach(v => {
            const opt = document.createElement("option");
            const val = typeof v === 'object' ? v.id : v;
            const text = typeof v === 'object' ? v.name : `${v} (Español)`;
            opt.value = val;
            opt.textContent = text;
            if (val === "Bruno") opt.selected = true;
            optgroup.appendChild(opt);
        });
        voiceSelect.appendChild(optgroup);
    }

    const modelHelpText = document.getElementById("modelHelpText");
    if (modelHelpText) {
        if (isKitten2) {
            modelHelpText.innerHTML = "⚠️ <strong>KittenTTS 2 (1.7B)</strong>: Modo de máxima calidad y emociones. En CPU realiza cálculo intensivo (~1 a 2 min). Para voz instantánea (1-2s), usa <strong>Ultrarrápido ONNX</strong>.";
            modelHelpText.style.color = "#fbbf24";
        } else {
            modelHelpText.innerHTML = "⚡ <strong>Modo Ultrarrápido ONNX</strong> seleccionado: tu audio se generará en <strong>1 a 2 segundos</strong> en tu CPU.";
            modelHelpText.style.color = "var(--accent)";
        }
    }
}

modelSelect.addEventListener("change", populateVoices);

speedRange.addEventListener("input", () => {
    speedVal.textContent = `${speedRange.value}x`;
});

// Generar botones de emociones y eventos
function populateExpressions() {
    if (!appInfo) return;
    emotionsContainer.innerHTML = "";
    eventsContainer.innerHTML = "";

    appInfo.emotions.forEach(emo => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip-btn";
        chip.innerHTML = `<span>${emo.icon}</span> <span>${emo.label}</span>`;
        chip.title = `Inserta ${emo.tag}`;
        chip.addEventListener("click", () => insertTagAtCursor(ttsTextInput, emo.tag + " "));
        emotionsContainer.appendChild(chip);
    });

    appInfo.vocal_events.forEach(evt => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip-btn";
        chip.innerHTML = `<span>${evt.icon}</span> <span>${evt.label}</span>`;
        chip.title = `Inserta ${evt.tag}`;
        chip.addEventListener("click", () => insertTagAtCursor(ttsTextInput, " " + evt.tag + " "));
        eventsContainer.appendChild(chip);
    });
}

function insertTagAtCursor(textarea, textToInsert) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    textarea.value = current.substring(0, start) + textToInsert + current.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
}

// Botones de ejemplos de texto
function setupExamples() {
    document.getElementById("btnEjemploEs").addEventListener("click", () => {
        ttsTextInput.value = "Hola, bienvenido a KittenTTS. Ahora puedes sintetizar texto a voz con una calidad impresionante.";
    });

    document.getElementById("btnEjemploEmocion").addEventListener("click", () => {
        modelSelect.value = "kitten2";
        populateVoices();
        voiceSelect.value = "Spanish";
        presetSelect.value = "expressive";
        ttsTextInput.value = "[joyful] ¡No vas a creer lo que pasó! <laugh> Conseguimos (((hacer andar))) toda la aplicación.";
    });

    document.getElementById("btnEjemploEn").addEventListener("click", () => {
        ttsTextInput.value = "One day, a little girl named Lily found a hidden secret in her garden.";
    });
}

// Generación de Audio TTS
btnGenerate.addEventListener("click", async () => {
    const text = ttsTextInput.value.trim();
    if (!text) {
        alert("Por favor, escribe un texto para generar el audio.");
        return;
    }

    startLoading("Generando voz...", modelSelect.value === "onnx" 
        ? "El modelo ONNX está sintetizando en milisegundos..." 
        : "KittenTTS 2 está decodificando los fonemas en CPU...");

    const formData = new FormData();
    formData.append("text", text);
    formData.append("model_type", modelSelect.value);
    formData.append("voice", voiceSelect.value);
    formData.append("language", "es");
    formData.append("preset", presetSelect.value);
    formData.append("speed", speedRange.value);

    try {
        const res = await fetch("/api/generate", {
            method: "POST",
            body: formData
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Error en la generación");
        }

        const data = await res.json();
        playGeneratedAudio(data, text);
        saveToHistory({
            ...data,
            text: text,
            date: new Date().toLocaleTimeString()
        });
    } catch (err) {
        alert("Ocurrió un error al generar el audio: " + err.message);
    } finally {
        stopLoading();
    }
});

// Configuración de Clonación de Voz
function setupCloning() {
    let audioStream = null;

    btnRecordMic.addEventListener("click", async () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            btnRecordMic.classList.remove("recording");
            recordLabel.textContent = "Grabar con Micrófono";
            clearInterval(recordTimerInterval);
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
            }
        } else {
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                recordedChunks = [];
                mediaRecorder = new MediaRecorder(audioStream);

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) recordedChunks.push(e.data);
                };

                mediaRecorder.onstop = () => {
                    recordedBlob = new Blob(recordedChunks, { type: "audio/wav" });
                    const audioUrl = URL.createObjectURL(recordedBlob);
                    previewSourceAudio.src = audioUrl;
                    previewSourceContainer.style.display = "flex";
                    fileNameLabel.innerHTML = `<strong>Voz grabada del micrófono</strong> (${recordTimer.textContent})`;
                    audioFileInput.value = "";
                };

                mediaRecorder.start();
                btnRecordMic.classList.add("recording");
                recordLabel.textContent = "Detener Grabación";
                recordStartTime = Date.now();
                recordTimerInterval = setInterval(() => {
                    const sec = Math.floor((Date.now() - recordStartTime) / 1000);
                    const m = String(Math.floor(sec / 60)).padStart(2, "0");
                    const s = String(sec % 60).padStart(2, "0");
                    recordTimer.textContent = `${m}:${s}`;
                }, 500);
            } catch (err) {
                alert("No se pudo acceder al micrófono: " + err.message);
            }
        }
    });

    audioFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            fileNameLabel.innerHTML = `<strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
            previewSourceAudio.src = URL.createObjectURL(file);
            previewSourceContainer.style.display = "flex";
            recordedBlob = null;
        }
    });

    // Drag and drop
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "var(--primary)";
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.style.borderColor = "rgba(255, 255, 255, 0.12)";
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "rgba(255, 255, 255, 0.12)";
        if (e.dataTransfer.files.length > 0) {
            audioFileInput.files = e.dataTransfer.files;
            audioFileInput.dispatchEvent(new Event("change"));
        }
    });

    // Botón Clonar
    btnClone.addEventListener("click", async () => {
        const text = cloneTextInput.value.trim();
        if (!text) {
            alert("Por favor, ingresa el texto que debe decir la voz clonada.");
            return;
        }

        let audioFileToUpload = null;
        if (recordedBlob) {
            audioFileToUpload = new File([recordedBlob], "mic_reference.wav", { type: "audio/wav" });
        } else if (audioFileInput.files.length > 0) {
            audioFileToUpload = audioFileInput.files[0];
        } else {
            alert("Debes grabar tu voz con el micrófono o subir un archivo de audio como referencia.");
            return;
        }

        startLoading("Clonando voz...", "Extrayendo el timbre del hablante y sintetizando el nuevo texto...");

        const formData = new FormData();
        formData.append("text", text);
        formData.append("reference_audio", audioFileToUpload);
        const refText = referenceTextInput.value.trim();
        if (refText) formData.append("reference_text", refText);

        try {
            const res = await fetch("/api/clone", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Error en la clonación");
            }

            const data = await res.json();
            playGeneratedAudio(data, text);
            saveToHistory({
                ...data,
                text: `[Voz Clonada] ${text}`,
                voice: "Clonada",
                date: new Date().toLocaleTimeString()
            });
        } catch (err) {
            alert("Error al clonar voz: " + err.message);
        } finally {
            stopLoading();
        }
    });
}

// Reproductor de Audio
function setupAudioPlayer() {
    btnPlayPause.addEventListener("click", () => {
        if (!currentAudio.src) return;
        if (currentAudio.paused) {
            currentAudio.play();
            playIcon.textContent = "⏸";
            startVisualizer();
        } else {
            currentAudio.pause();
            playIcon.textContent = "▶";
            cancelAnimationFrame(animationId);
        }
    });

    currentAudio.addEventListener("timeupdate", () => {
        if (!currentAudio.duration) return;
        const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
        progressBar.style.width = `${progress}%`;
        audioTimeLabel.textContent = `${formatTime(currentAudio.currentTime)} / ${formatTime(currentAudio.duration)}`;
    });

    currentAudio.addEventListener("ended", () => {
        playIcon.textContent = "▶";
        progressBar.style.width = "0%";
        cancelAnimationFrame(animationId);
    });

    progressBarContainer.addEventListener("click", (e) => {
        if (!currentAudio.duration) return;
        const rect = progressBarContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const newTime = (clickX / rect.width) * currentAudio.duration;
        currentAudio.currentTime = newTime;
    });
}

function playGeneratedAudio(data, text) {
    playerCard.style.display = "block";
    playerModelBadge.textContent = data.model_type.toUpperCase();
    playerVoiceBadge.textContent = data.voice || "Clonada";
    playerTimeBadge.textContent = `⚡ Generado en ${data.generation_time}s`;
    playerTextPreview.textContent = `"${text}"`;
    btnDownload.href = data.url;
    btnDownload.download = data.filename;

    currentAudio.src = data.url;
    currentAudio.play();
    playIcon.textContent = "⏸";
    startVisualizer();
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

// Visualizador Canvas Audio
function startVisualizer() {
    if (!isVisualizerInit) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 128;
            sourceNode = audioContext.createMediaElementSource(currentAudio);
            sourceNode.connect(analyser);
            analyser.connect(audioContext.destination);
            isVisualizerInit = true;
        } catch (e) {
            console.log("AudioContext ya inicializado o restringido:", e);
        }
    }

    if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
    }

    drawWave();
}

function drawWave() {
    if (currentAudio.paused) return;
    animationId = requestAnimationFrame(drawWave);

    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);
    if (analyser) analyser.getByteFrequencyData(dataArray);

    const width = waveformCanvas.width;
    const height = waveformCanvas.height;

    canvasCtx.clearRect(0, 0, width, height);

    const barWidth = (width / bufferLength) * 1.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.9 + 4;
        
        const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, "#8b5cf6");
        gradient.addColorStop(1, "#06b6d4");
        
        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
    }
}

// Loading Overlay
function startLoading(title, subtitle) {
    loadingTitle.textContent = title;
    loadingSubtitle.textContent = subtitle;
    elapsedSeconds.textContent = "0";
    loadingOverlay.style.display = "flex";
    const start = Date.now();
    elapsedInterval = setInterval(() => {
        elapsedSeconds.textContent = Math.floor((Date.now() - start) / 1000);
    }, 1000);
}

function stopLoading() {
    clearInterval(elapsedInterval);
    loadingOverlay.style.display = "none";
}

// Historial en LocalStorage
function saveToHistory(item) {
    const history = JSON.parse(localStorage.getItem("kittentts_history") || "[]");
    history.unshift(item);
    if (history.length > 25) history.pop();
    localStorage.setItem("kittentts_history", JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById("historyList");
    const history = JSON.parse(localStorage.getItem("kittentts_history") || "[]");
    list.innerHTML = "";

    if (history.length === 0) {
        list.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Aún no has generado ningún audio. ¡Prueba una frase arriba!</p>`;
        return;
    }

    history.forEach(item => {
        const row = document.createElement("div");
        row.className = "history-item";
        row.innerHTML = `
            <div class="history-meta">
                <p class="history-text">"${item.text}"</p>
                <div class="history-details">
                    <span>🎙️ ${item.voice || 'Default'}</span>
                    <span>⏱️ ${item.duration}s</span>
                    <span>⚡ Gen: ${item.generation_time}s</span>
                    <span>📅 ${item.date || ''}</span>
                </div>
            </div>
            <div class="history-actions">
                <button class="btn-play-circle" style="width: 36px; height: 36px; font-size: 0.9rem;" onclick="playUrl('${item.url}', '${item.text.replace(/'/g, "\\'")}', '${item.voice || ''}')">
                    ▶
                </button>
                <a href="${item.url}" download="${item.filename}" class="btn-icon-action" style="width: 36px; height: 36px;" title="Descargar WAV">
                    ⬇️
                </a>
            </div>
        `;
        list.appendChild(row);
    });
}

window.playUrl = (url, text, voice) => {
    playerCard.style.display = "block";
    playerTextPreview.textContent = `"${text}"`;
    playerVoiceBadge.textContent = voice || "Voz";
    playerModelBadge.textContent = "HISTORIAL";
    playerTimeBadge.textContent = "";
    btnDownload.href = url;
    currentAudio.src = url;
    currentAudio.play();
    playIcon.textContent = "⏸";
    startVisualizer();
};

document.getElementById("btnClearHistory").addEventListener("click", () => {
    if (confirm("¿Deseas vaciar el historial de audios?")) {
        localStorage.removeItem("kittentts_history");
        renderHistory();
    }
});
