function openTool(toolType) {
    const modal = document.getElementById(`${toolType}Modal`);
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {

    const darkenInput = document.getElementById('darkenImage');
    if (darkenInput) {
        darkenInput.addEventListener('change', function(e) {
            handleFileSelect(e, 'darkenPreview', 'darkenResult');
        });
    }

    const baldInput = document.getElementById('baldImage');
    if (baldInput) {
        baldInput.addEventListener('change', function(e) {
            handleFileSelect(e, 'baldPreview', 'baldResult');
        });
    }

});

function handleFileSelect(event, previewId, resultId) {
    const file = event.target.files[0];
    const preview = document.getElementById(previewId);
    const resultDiv = document.getElementById(resultId);
    
    if (file && preview) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            showError('Hanya file gambar (JPEG, JPG, PNG, GIF) yang diperbolehkan!', resultId);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showError('Ukuran file maksimal 5MB!', resultId);
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" id="${previewId}Img">`;
            if (resultDiv) resultDiv.innerHTML = '';
        };
        reader.readAsDataURL(file);
    }
}

async function processWaifu(processType) {
    const imageInput = document.getElementById(`${processType}Image`);
    const resultDiv = document.getElementById(`${processType}Result`);
    const previewImg = document.getElementById(`${processType}PreviewImg`);
    
    if (!imageInput || !imageInput.files[0]) {
        showError('Silakan pilih gambar terlebih dahulu!', `${processType}Result`);
        return;
    }

    if (!previewImg) {
        showError('Tunggu gambar selesai dimuat!', `${processType}Result`);
        return;
    }

    resultDiv.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const file = imageInput.files[0];
        const reader = new FileReader();

        reader.onload = async function(e) {
            const imageData = e.target.result;

            try {
                const response = await fetch('/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageData: imageData,
                        processType: processType
                    })
                });

                const data = await response.json();

                let resultHTML = '';

                if (data.success && data.processedImage) {
                    resultHTML = `
                        <div class="result-container">
                            <div class="image-comparison">
                                <div class="image-box">
                                    <h4>Original</h4>
                                    <img src="${previewImg.src}" class="result-image">
                                </div>
                                <div class="image-box">
                                    <h4>Hasil</h4>
                                    <img src="${data.processedImage}" class="result-image">
                                    <button onclick="downloadImage('${data.processedImage}', '${processType}')" class="download-btn">📥 Download</button>
                                </div>
                            </div>
                        </div>
                    `;

                } else {
                    // fallback canvas
                    const processedImageData = await processImageWithCanvas(previewImg.src, processType);

                    resultHTML = `
                        <div class="result-container">
                            <div class="image-comparison">
                                <div class="image-box">
                                    <h4>Original</h4>
                                    <img src="${previewImg.src}" class="result-image">
                                </div>
                                <div class="image-box">
                                    <h4>Hasil</h4>
                                    <img src="${processedImageData}" class="result-image">
                                    <button onclick="downloadImage('${processedImageData}', '${processType}')" class="download-btn">📥 Download</button>
                                </div>
                            </div>
                            <div class="analysis-result">
                                <h4>Analisis:</h4>
                                <p>Diproses menggunakan metode Canvas.</p>
                            </div>
                        </div>
                    `;
                }

                resultDiv.innerHTML = resultHTML;

            } catch (error) {
                console.error(error);
                showError('Terjadi kesalahan saat memproses gambar.', `${processType}Result`);
            }
        };

        reader.readAsDataURL(file);

    } catch (error) {
        console.error(error);
        showError('Terjadi kesalahan tak terduga.', `${processType}Result`);
    }
}

function processImageWithCanvas(imageSrc, processType) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            if (processType === 'darken') {
                for (let i = 0; i < data.length; i += 4) {
                    if (isSkinTone(data[i], data[i+1], data[i+2])) {
                        data[i] -= 40;
                        data[i+1] -= 35;
                        data[i+2] -= 30;
                    }
                }
            }

            if (processType === 'bald') {
                const headCenterX = canvas.width / 2;
                const headCenterY = canvas.height / 4;
                const radius = Math.min(canvas.width, canvas.height) / 4;

                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const dist = Math.sqrt((x - headCenterX)**2 + (y - headCenterY)**2);
                        if (dist < radius * 0.7) {
                            const index = (y * canvas.width + x) * 4;
                            data[index] = 240;
                            data[index+1] = 200;
                            data[index+2] = 160;
                        }
                    }
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
        };

        img.onerror = reject;
        img.src = imageSrc;
    });
}

function isSkinTone(r, g, b) {
    return r > 150 && g > 100 && b > 80 && r > g && r > b;
}

function downloadImage(url, type) {
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'darken' ? 'waifu_gelap.png' : 'waifu_botak.png';
    a.click();
}

function showError(message, resultId) {
    const resultDiv = document.getElementById(resultId);
    if (resultDiv) {
        resultDiv.innerHTML = `<div class="error">${message}</div>`;
    }
}

