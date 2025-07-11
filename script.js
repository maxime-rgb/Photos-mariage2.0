// --- Configuration Cloudinary ---
// REMPLACEZ CES VALEURS PAR LES VÔTRES !
const CLOUD_NAME = 'photosmariage'; // Ex: 'dpxxxxxxx'
const UPLOAD_PRESET = 'ml_default'; // Ex: 'mariage_photos_unsigned'


// --- Références aux éléments HTML ---
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const messagesDiv = document.getElementById('messages');
const uploadedMediaGrid = document.getElementById('uploaded-media-grid');
const uploadProgressContainer = document.getElementById('upload-progress-container');

let selectedFiles = [];

// --- Événements ---

fileInput.addEventListener('change', (event) => {
    selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length > 0) {
        uploadButton.disabled = false;
        displayMessage(`${selectedFiles.length} fichier(s) sélectionné(s).`, 'info');
    } else {
        uploadButton.disabled = true;
        displayMessage('', 'info');
    }
    uploadProgressContainer.innerHTML = '';
});

uploadButton.addEventListener('click', async() => {
    if (selectedFiles.length === 0) {
        displayMessage('Veuillez sélectionner des fichiers à envoyer.', 'error');
        return;
    }

    uploadButton.disabled = true;
    fileInput.disabled = true;
    displayMessage('Envoi en cours... Veuillez patienter.', 'info');
    uploadedMediaGrid.innerHTML = '';
    uploadProgressContainer.innerHTML = '';

    const uploadPromises = selectedFiles.map(file => {
        const progressItem = document.createElement('div');
        progressItem.className = 'file-upload-item';
        progressItem.innerHTML = `
            <span class="filename">${file.name}</span>
            <div class="progress-bar-container">
                <div class="progress-bar" id="progress-${file.name.replace(/[^a-zA-Z0-9]/g, '')}"></div>
            </div>
            <span class="status-text" id="status-${file.name.replace(/[^a-zA-Z0-9]/g, '')}">0%</span>
        `;
        uploadProgressContainer.appendChild(progressItem);

        const onProgress = (percent) => {
            const progressBar = document.getElementById(`progress-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`);
            const statusText = document.getElementById(`status-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`);
            if (progressBar && statusText) {
                progressBar.style.width = `${percent}%`;
                statusText.textContent = `${Math.round(percent)}%`;
            }
        };

        return uploadFileToCloudinary(file, onProgress);
    });

    try {
        const results = await Promise.allSettled(uploadPromises);

        const successfulUploads = results.filter(result => result.status === 'fulfilled' && result.value.success);
        const failedUploads = results.filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success));

        if (successfulUploads.length > 0) {
            displayMessage(`${successfulUploads.length} fichier(s) envoyé(s) avec succès !`, 'success');
            successfulUploads.forEach(result => displayUploadedMedia(result.value.url, result.value.resource_type));
        }
        if (failedUploads.length > 0) {
            const errorMessages = failedUploads.map(result => {
                if (result.status === 'rejected') {
                    return result.reason.error || 'Erreur inconnue'; // Utiliser result.reason.error ici
                } else {
                    return result.value.error || 'Erreur inconnue';
                }
            }).join('; ');
            displayMessage(`${failedUploads.length} fichier(s) n'ont pas pu être envoyés. Détails: ${errorMessages}`, 'error');
            failedUploads.forEach(result => console.error(`Échec de l'upload:`, result));
        }
    } catch (error) {
        console.error('Erreur inattendue lors de l\'envoi des fichiers:', error);
        displayMessage('Une erreur inattendue est survenue lors de l\'envoi.', 'error');
    } finally {
        uploadButton.disabled = false;
        fileInput.disabled = false;
        fileInput.value = '';
        selectedFiles = [];
    }
});

// --- Fonctions Utilitaires ---

function displayMessage(message, type) {
    messagesDiv.innerHTML = message;
    messagesDiv.className = '';
    if (type) {
        messagesDiv.classList.add(type);
    }
}

/**
 * Envoie un fichier unique à Cloudinary avec suivi de progression.
 * @param {File} file Le fichier à envoyer.
 * @param {Function} onProgress Callback pour la progression (0-100%).
 * @returns {Promise<Object>} Une promesse qui résout avec l'URL sécurisée et le type de ressource, ou rejette avec une erreur.
 */
async function uploadFileToCloudinary(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    try {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', uploadUrl);

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percent = (event.loaded / event.total) * 100;
                    onProgress(percent);
                }
            });

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const data = JSON.parse(xhr.responseText);
                    onProgress(100);
                    resolve({ success: true, url: data.secure_url, resource_type: data.resource_type, filename: file.name });
                } else {
                    const errorData = JSON.parse(xhr.responseText || '{}');
                    // LIGNE CORRIGÉE ICI : Remplacement de ?. par une vérification classique
                    reject({ success: false, error: (errorData.error && errorData.error.message) || `Erreur réseau ou serveur Cloudinary: ${xhr.status}`, filename: file.name });
                }
            };

            xhr.onerror = () => {
                reject({ success: false, error: 'Erreur réseau lors de l\'upload.', filename: file.name });
            };

            xhr.send(formData);
        });

    } catch (error) {
        console.error(`Erreur lors de l'upload de ${file.name}:`, error);
        throw { success: false, error: error.message, filename: file.name };
    }
}

function displayUploadedMedia(url, type) {
    if (type === 'image') {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Photo de mariage';
        uploadedMediaGrid.appendChild(img);
    } else if (type === 'video') {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.autoplay = false;
        video.muted = true;
        video.preload = 'metadata';
        uploadedMediaGrid.appendChild(video);
    }
}