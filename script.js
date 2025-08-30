// --- DOM Elements ---
const dropZone = document.getElementById('drop-zone');
const imageInput = document.getElementById('imageInput');
const imageUrlInput = document.getElementById('imageUrlInput');
const loadImageBtn = document.getElementById('loadImageBtn');
const formatSelect = document.getElementById('formatSelect');
const qualitySection = document.getElementById('qualitySection');
const manualQualityRadio = document.getElementById('manualQuality');
const targetSizeRadio = document.getElementById('targetSize');
const qualityControl = document.getElementById('qualityControl');
const qualitySlider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');
const targetSizeControl = document.getElementById('targetSizeControl');
const sizeInput = document.getElementById('sizeInput');
const sizeUnit = document.getElementById('sizeUnit');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const aspectRatioCheckbox = document.getElementById('aspectRatioCheckbox');
const compressBtn = document.getElementById('compressBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
const imageQueueContainer = document.getElementById('imageQueueContainer');
const queueCount = document.getElementById('queueCount');
const previewContainer = document.getElementById('previewContainer');
const previewText = document.getElementById('previewText');
const comparisonSlider = document.getElementById('comparisonSlider');
const originalPreview = document.getElementById('originalPreview');
const compressedPreview = document.getElementById('compressedPreview');
const themeToggle = document.getElementById('theme-toggle');
const themeIconLight = document.getElementById('theme-icon-light');
const themeIconDark = document.getElementById('theme-icon-dark');
// Editor Modal Elements
const editorModal = document.getElementById('editor-modal');
const editorImage = document.getElementById('editor-image');
const closeEditorBtn = document.getElementById('close-editor-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');
const cropBtn = document.getElementById('crop-btn');
const rotateLeftBtn = document.getElementById('rotate-left-btn');
const rotateRightBtn = document.getElementById('rotate-right-btn');
const flipHBtn = document.getElementById('flip-h-btn');
const flipVBtn = document.getElementById('flip-v-btn');
const editPreviewBtn = document.getElementById('editPreviewBtn');

// --- State ---
let imageQueue = [];
let isProcessing = false;
let activePreviewIndex = 0;
let editorState = {
    item: null,
    cropper: null,
    scaleH: 1,
    scaleV: 1,
    isCropping: false,
};

// --- Theme Toggle ---
function updateThemeIcon() {
    if (document.documentElement.classList.contains('dark')) {
        themeIconLight.classList.remove('hidden');
        themeIconDark.classList.add('hidden');
    } else {
        themeIconLight.classList.add('hidden');
        themeIconDark.classList.remove('hidden');
    }
}
themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    updateThemeIcon();
});
updateThemeIcon();


// --- Event Listeners ---
imageInput.addEventListener('change', handleFileSelection);
loadImageBtn.addEventListener('click', handleUrlLoad);
formatSelect.addEventListener('change', updateOutputSettingsVisibility);
document.querySelectorAll('input[name="lossyMode"]').forEach(radio => {
    radio.addEventListener('change', updateQualityMode);
});
qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = `${Math.round(qualitySlider.value * 100)}%`;
    recompressActiveImage();
});
sizeInput.addEventListener('input', recompressActiveImage);
sizeUnit.addEventListener('change', recompressActiveImage);

compressBtn.addEventListener('click', processQueue);
downloadAllBtn.addEventListener('click', downloadAllAsZip);
downloadSelectedBtn.addEventListener('click', () => {
    if (imageQueue.length > 0 && activePreviewIndex < imageQueue.length) {
        const item = imageQueue[activePreviewIndex];
        downloadImage(item.id);
    }
});
widthInput.addEventListener('input', handleDimensionChange);
heightInput.addEventListener('input', handleDimensionChange);

// --- Drag and Drop Listeners ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
});
['dragenter', 'dragover'].forEach(eventName => {
    document.body.addEventListener(eventName, () => dropZone.classList.add('drag-over'));
});
['dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, () => dropZone.classList.remove('drag-over'));
});
document.body.addEventListener('drop', (e) => {
    handleDroppedFiles(e.dataTransfer.files);
});

// --- Editor Listeners ---
closeEditorBtn.addEventListener('click', closeEditor);
cancelEditBtn.addEventListener('click', closeEditor);
saveEditBtn.addEventListener('click', saveEditorChanges);
rotateLeftBtn.addEventListener('click', () => editorState.cropper?.rotate(-90));
rotateRightBtn.addEventListener('click', () => editorState.cropper?.rotate(90));
flipHBtn.addEventListener('click', () => {
    editorState.scaleH *= -1;
    editorState.cropper?.scaleX(editorState.scaleH);
});
flipVBtn.addEventListener('click', () => {
    editorState.scaleV *= -1;
    editorState.cropper?.scaleY(editorState.scaleV);
});
cropBtn.addEventListener('click', toggleCropMode);
editPreviewBtn.addEventListener('click', () => {
    if (imageQueue.length > 0 && activePreviewIndex < imageQueue.length) {
        const item = imageQueue[activePreviewIndex];
        openEditor(item.id);
    }
});

// --- Functions ---
function handleFileSelection(e) {
    handleDroppedFiles(e.target.files);
    imageInput.value = '';
}

function handleDroppedFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            addImageToQueue(file);
        }
    });
}

async function handleUrlLoad() {
    const url = imageUrlInput.value.trim();
    if (!url) { alert('Please enter an image URL.'); return; }
    
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const blob = await response.blob();
        const fileName = url.substring(url.lastIndexOf('/') + 1) || 'image.jpg';
        const file = new File([blob], fileName, { type: blob.type });
        addImageToQueue(file);
        imageUrlInput.value = '';

    } catch (error) {
        console.error('Error fetching image from URL:', error);
        alert('Could not load image from the URL. Please check the URL and try again.');
    }
}

function addImageToQueue(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const imageItem = {
                file,
                id: `image-${Date.now()}-${Math.random()}`,
                originalUrl: event.target.result,
                width: img.width,
                height: img.height,
                aspectRatio: img.width / img.height,
                status: 'pending',
                compressedBlob: null,
                originalSize: file.size,
                compressedSize: null,
            };
            imageQueue.push(imageItem);
            activePreviewIndex = imageQueue.length - 1;
            renderQueue();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function renderQueue() {
    imageQueueContainer.innerHTML = '';
    if (imageQueue.length === 0) {
        imageQueueContainer.innerHTML = '<p class="text-slate-500 dark:text-slate-400 text-sm">No Images Added Yet.</p>';
    } else {
        imageQueue.forEach((item, index) => {
            const queueElement = createQueueElement(item, index);
            imageQueueContainer.appendChild(queueElement);
        });
    }
    queueCount.textContent = imageQueue.length;
    updatePreview();
    updateButtonStates();
}

function createQueueElement(item, index) {
    const div = document.createElement('div');
    div.id = item.id;
    const isSelected = index === activePreviewIndex;
    div.className = `flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all duration-200 ${isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-slate-700/50 dark:border-indigo-500 shadow' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`;
    div.onclick = () => {
        activePreviewIndex = index;
        renderQueue();
    };

    const originalSizeKB = (item.originalSize / 1024).toFixed(1);
    let sizeInfo = `${originalSizeKB} KB`;
    if (item.status === 'done' && item.compressedSize) {
        const compressedSizeKB = (item.compressedSize / 1024).toFixed(1);
        const reduction = 100 - (item.compressedSize / item.originalSize * 100);
        sizeInfo = `<span class="font-semibold text-green-600 dark:text-green-400">${compressedSizeKB} KB</span> <span class="text-xs text-slate-500">(${reduction.toFixed(0)}% smaller)</span>`;
    }

    div.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
            <img src="${item.originalUrl}" class="w-10 h-10 object-cover rounded-md flex-shrink-0">
            <div class="text-sm overflow-hidden">
                <p class="font-medium truncate text-slate-700 dark:text-slate-300">${item.file.name}</p>
                <p class="text-slate-500 dark:text-slate-400">${sizeInfo}</p>
            </div>
        </div>
        <div class="flex items-center gap-2 ml-2 flex-shrink-0">
            <button class="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600" onclick="event.stopPropagation(); removeImageFromQueue('${item.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
            </button>
            <div class="status-indicator">
                ${getStatusIndicator(item)}
            </div>
        </div>
    `;
    return div;
}

function getStatusIndicator(item) {
    switch(item.status) {
        case 'pending': return `<span class="text-xs font-semibold text-slate-500" title="Pending Compression">Pending</span>`;
        case 'processing': return `<div class="loader"></div>`;
        case 'done': return `<div class="flex items-center gap-1 text-indigo-600 dark:text-indigo-400" title="Completed"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg><span class="text-xs font-semibold">Done</span></div>`;
        case 'error': return `<span class="text-xs font-semibold text-red-500">Error</span>`;
        default: return '';
    }
}

function updatePreview() {
    if (imageQueue.length === 0 || activePreviewIndex >= imageQueue.length) {
        previewText.style.display = 'block';
        comparisonSlider.classList.add('hidden');
        previewContainer.style.aspectRatio = 'auto';
        editPreviewBtn.disabled = true;
        return;
    }
    
    previewText.style.display = 'none';
    comparisonSlider.classList.remove('hidden');
    editPreviewBtn.disabled = false;

    const item = imageQueue[activePreviewIndex];
    previewContainer.style.aspectRatio = `${item.width} / ${item.height}`;
    originalPreview.src = item.originalUrl;
    compressedPreview.src = item.compressedBlob ? URL.createObjectURL(item.compressedBlob) : item.originalUrl;
    comparisonSlider.value = 50;
    updateOutputSettingsVisibility();
}

function updateOutputSettingsVisibility() {
    const selectedFormat = formatSelect.value;
    const activeItem = imageQueue[activePreviewIndex];
    const isLossy = selectedFormat === 'image/jpeg' || selectedFormat === 'image/webp' || (selectedFormat === 'auto' && activeItem && activeItem.file.type.includes('jpeg'));

    if (isLossy) {
        qualitySection.classList.remove('hidden');
    } else {
        qualitySection.classList.add('hidden');
    }
}

function updateQualityMode() {
    if (manualQualityRadio.checked) {
        qualityControl.classList.remove('hidden');
        targetSizeControl.classList.add('hidden');
    } else {
        qualityControl.classList.add('hidden');
        targetSizeControl.classList.remove('hidden');
    }
    recompressActiveImage();
}

function handleDimensionChange(e) {
    if (!aspectRatioCheckbox.checked || imageQueue.length === 0) return;
    
    const activeInput = e.target;
    const otherInput = activeInput.id === 'widthInput' ? heightInput : widthInput;
    const item = imageQueue[activePreviewIndex];
    if (!item) return;

    const value = parseInt(activeInput.value, 10);
    if (!isNaN(value) && value > 0) {
        if (activeInput.id === 'widthInput') {
            otherInput.value = Math.round(value / item.aspectRatio);
        } else {
            otherInput.value = Math.round(value * item.aspectRatio);
        }
    }
}

let recompressTimeout;
function recompressActiveImage() {
    clearTimeout(recompressTimeout);
    recompressTimeout = setTimeout(async () => {
        const item = imageQueue[activePreviewIndex];
        if (!item || item.status !== 'done') return;
        
        try {
            const blob = await compressImage(item);
            item.compressedBlob = blob;
            item.compressedSize = blob.size;
            renderQueue();
        } catch (err) {
            console.error("Re-compression failed:", err);
        }
    }, 300); // Debounce to avoid rapid re-compression
}

async function processQueue() {
    isProcessing = true;
    renderQueue();
    
    for (let i = 0; i < imageQueue.length; i++) {
        const item = imageQueue[i];
        if (item.status === 'done') continue;
        
        item.status = 'processing';
        renderQueue();

        try {
            const blob = await compressImage(item);
            item.compressedBlob = blob;
            item.compressedSize = blob.size;
            item.status = 'done';
        } catch (err) {
            console.error("Compression failed for", item.file.name, err);
            item.status = 'error';
        }
        renderQueue();
    }
    
    isProcessing = false;
    renderQueue();
}

async function compressImage(item) {
    const canvas = await createImageCanvas(item);
    let format = formatSelect.value;

    if (format === 'auto') {
        format = item.file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    }

    if (format === 'image/png' || format === 'image/webp_lossless') {
        const finalMimeType = format === 'image/webp_lossless' ? 'image/webp' : 'image/png';
        return getBlob(canvas, finalMimeType, 1.0);
    }

    // Handle lossy formats
    const lossyMode = document.querySelector('input[name="lossyMode"]:checked').value;
    const mimeType = format;
    if (lossyMode === 'manual') {
        const quality = parseFloat(qualitySlider.value);
        return getBlob(canvas, mimeType, quality);
    } else { // Target Size
        const targetSizeValue = parseFloat(sizeInput.value);
        const targetSizeUnit = sizeUnit.value;
        const targetBytes = targetSizeUnit === 'MB' ? targetSizeValue * 1024 * 1024 : targetSizeValue * 1024;
        const finalBlob = await compressToTargetSize(canvas, mimeType, targetBytes);
        if (!finalBlob) throw new Error("Could not compress to target size. Try a larger size.");
        return finalBlob;
    }
}

function createImageCanvas(item) {
     return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const targetWidth = parseInt(widthInput.value, 10) || img.width;
            const targetHeight = parseInt(heightInput.value, 10) || img.height;
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            resolve(canvas);
        };
        img.onerror = reject;
        img.src = item.originalUrl;
    });
}

function getBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed.'));
        }, mimeType, quality);
    });
}

async function compressToTargetSize(canvas, mimeType, targetBytes, tolerance = 0.05) {
    let minQuality = 0;
    let maxQuality = 1;
    let bestBlob = null;

    for (let i = 0; i < 8; i++) {
        const quality = (minQuality + maxQuality) / 2;
        const blob = await getBlob(canvas, mimeType, quality);
        
        if (Math.abs(blob.size - targetBytes) <= targetBytes * tolerance) return blob;

        if (blob.size > targetBytes) {
            maxQuality = quality;
        } else {
            minQuality = quality;
            bestBlob = blob;
        }
    }
    if (!bestBlob) {
        bestBlob = await getBlob(canvas, mimeType, 0);
        if (bestBlob.size > targetBytes) return null;
    }
    return bestBlob;
}

// --- Editor Functions ---
window.openEditor = (itemId) => {
    const item = imageQueue.find(i => i.id === itemId);
    if (!item) return;

    editorState.item = item;
    editorImage.src = item.originalUrl;
    
    editorModal.classList.remove('hidden');
    setTimeout(() => {
        editorModal.firstElementChild.classList.remove('scale-95');
        editorState.cropper = new Cropper(editorImage, {
            viewMode: 1,
            background: false,
            autoCrop: false,
            dragMode: 'move',
        });
    }, 10);
}

function closeEditor() {
    editorModal.firstElementChild.classList.add('scale-95');
    setTimeout(() => {
        editorModal.classList.add('hidden');
        editorState.cropper?.destroy();
        editorState.cropper = null;
        editorState.isCropping = false;
        cropBtn.classList.remove('editor-btn-active');
    }, 300);
}

function toggleCropMode() {
    if (!editorState.cropper) return;
    editorState.isCropping = !editorState.isCropping;
    if (editorState.isCropping) {
        editorState.cropper.crop();
        editorState.cropper.setDragMode('crop');
        cropBtn.classList.add('editor-btn-active');
    } else {
        editorState.cropper.clear();
        editorState.cropper.setDragMode('move');
        cropBtn.classList.remove('editor-btn-active');
    }
}

function saveEditorChanges() {
    const { item, cropper } = editorState;
    if (!item || !cropper) return;
    
    const canvas = cropper.getCroppedCanvas();
    canvas.toBlob(async (blob) => {
        const newFile = new File([blob], item.file.name, { type: blob.type });
        const newUrl = URL.createObjectURL(blob);
        
        URL.revokeObjectURL(item.originalUrl);

        item.file = newFile;
        item.originalUrl = newUrl;
        item.originalSize = blob.size;
        item.width = canvas.width;
        item.height = canvas.height;
        item.aspectRatio = canvas.width / canvas.height;

        item.status = 'pending';
        item.compressedBlob = null;
        item.compressedSize = null;

        renderQueue();
        closeEditor();
    }, 'image/png');
}

window.downloadImage = (itemId) => {
    const item = imageQueue.find(i => i.id === itemId);
    if (item && item.compressedBlob) {
        const url = URL.createObjectURL(item.compressedBlob);
        const a = document.createElement('a');
        a.href = url;
        const nameParts = item.file.name.split('.');
        const extension = item.compressedBlob.type.split('/')[1];
        nameParts.pop();
        a.download = `${nameParts.join('.')}-compressed.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

window.removeImageFromQueue = (itemId) => {
    const indexToRemove = imageQueue.findIndex(i => i.id === itemId);
    if (indexToRemove === -1) return;

    const itemToRemove = imageQueue[indexToRemove];
    URL.revokeObjectURL(itemToRemove.originalUrl);
    if (itemToRemove.compressedBlob) {
        URL.revokeObjectURL(URL.createObjectURL(itemToRemove.compressedBlob));
    }

    imageQueue.splice(indexToRemove, 1);

    if (activePreviewIndex >= indexToRemove) {
        activePreviewIndex = Math.max(0, activePreviewIndex - 1);
    }
    
    if (imageQueue.length === 0) {
        activePreviewIndex = 0;
    }

    renderQueue();
};

function updateButtonStates() {
    const anyPending = imageQueue.some(item => item.status === 'pending');
    const allDone = imageQueue.length > 0 && imageQueue.every(item => item.status === 'done');
    const selectedDone = imageQueue[activePreviewIndex] && imageQueue[activePreviewIndex].status === 'done';

    compressBtn.disabled = !anyPending || isProcessing;
    downloadSelectedBtn.disabled = !selectedDone || isProcessing;
    downloadAllBtn.disabled = !allDone || isProcessing || imageQueue.length < 2;
}

async function downloadAllAsZip() {
    const zip = new JSZip();
    imageQueue.forEach(item => {
        if (item.compressedBlob) {
            const nameParts = item.file.name.split('.');
            const extension = item.compressedBlob.type.split('/')[1];
            nameParts.pop();
            const fileName = `${nameParts.join('.')}-compressed.${extension}`;
            zip.file(fileName, item.compressedBlob);
        }
    });

    zip.generateAsync({ type: "blob" }).then(content => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = "compressed_images.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
}

// --- Initial Render ---
renderQueue();
updateOutputSettingsVisibility();
updateQualityMode();
