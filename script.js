// --- Configuration Cloudinary ---
// REMPLACEZ CES VALEURS PAR LES VÔTRES !
const CLOUD_NAME = 'VOTRE_CLOUD_NAME'; // Ex: 'dpxxxxxxx'
const UPLOAD_PRESET = 'VOTRE_UPLOAD_PRESET'; // Ex: 'mariage_photos_unsigned'

// --- Références aux éléments HTML ---
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const messagesDiv = document.getElementById('messages');
const uploadedMediaGrid = document.getElementById('uploaded-media-grid'); // Nouvelle référence

let selectedFiles = []; // Tableau pour stocker les fichiers sélectionnés

// --- Événements ---

// Quand des fichiers sont sélectionnés dans l'input
fileInput.addEventListener('change', (event) => {
    selectedFiles = Array.from(event.target.files); // Convertir FileList en Array
    if (selectedFiles.length > 0) {
        uploadButton.disabled = false; // Activer le bouton d'upload
        displayMessage(`${selectedFiles.length} fichier(s) sélectionné(s).`, 'info');
    } else {
        uploadButton.disabled = true;
        displayMessage('', 'info'); // Effacer le message
    }
});

// Quand le bouton d'upload est cliqué
uploadButton.addEventListener('click', async() => {
    if (selectedFiles.length === 0) {
        displayMessage('Veuillez sélectionner des fichiers à envoyer.', 'error');
        return;
    }

    // Désactiver les contrôles pendant l'upload
    uploadButton.disabled = true;
    fileInput.disabled = true;
    displayMessage('Envoi en cours... Veuillez patienter.', 'info');
    uploadedMediaGrid.innerHTML = ''; // Nettoyer la grille des médias précédents

    // Créer une promesse d'upload pour chaque fichier
    const uploadPromises = selectedFiles.map(file => uploadFileToCloudinary(file));

    try {
        // Attendre que toutes les promesses soient résolues (succès ou échec)
        const results = await Promise.allSettled(uploadPromises); // Utilisez Promise.allSettled pour gérer les échecs individuels

        const successfulUploads = results.filter(result => result.status === 'fulfilled' && result.value.success);
        const failedUploads = results.filter(result => result.status === 'rejected' || !result.value.success);

        if (successfulUploads.length > 0) {
            displayMessage(`${successfulUploads.length} fichier(s) envoyé(s) avec succès !`, 'success');
            successfulUploads.forEach(result => displayUploadedMedia(result.value.url, result.value.resource_type));
        }
        if (failedUploads.length > 0) {
            const errorMessages = failedUploads.map(result => {
                if (result.status === 'rejected') {
                    return result.reason.message || 'Erreur inconnue';
                } else {
                    return result.value.error || 'Erreur inconnue';
                }
            }).join('; ');
            displayMessage(`${failedUploads.length} fichier(s) n'ont pas pu être envoyés. Détails: ${errorMessages}`, 'error');
            failedUploads.forEach(result => console.error(`Échec de l'upload:`, result));
        }
    } catch (error) {
        // Cette erreur ne devrait se produire que si Promise.all (pas allSettled) était utilisé et qu'une promesse rejetait.
        // Avec allSettled, les rejets sont capturés dans les résultats.
        console.error('Erreur inattendue lors de l\'envoi des fichiers:', error);
        displayMessage('Une erreur inattendue est survenue lors de l\'envoi.', 'error');
    } finally {
        // Réactiver les contrôles et réinitialiser l'input
        uploadButton.disabled = false;
        fileInput.disabled = false;
        fileInput.value = ''; // Réinitialiser l'input file pour permettre de sélectionner les mêmes fichiers à nouveau
        selectedFiles = []; // Vider la sélection
    }
});

// --- Fonctions Utilitaires ---

/**
 * Affiche un message à l'utilisateur.
 * @param {string} message Le message à afficher.
 * @param {string} type Le type de message ('info', 'success', 'error').
 */
function displayMessage(message, type) {
    messagesDiv.innerHTML = message;
    messagesDiv.className = ''; // Réinitialiser les classes
    if (type) {
        messagesDiv.classList.add(type);
    }
}

/**
 * Envoie un fichier unique à Cloudinary.
 * @param {File} file Le fichier à envoyer.
 * @returns {Promise<Object>} Une promesse qui résout avec l'URL sécurisée et le type de ressource, ou rejette avec une erreur.
 */
async function uploadFileToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    // Détecter le type de ressource (image ou vidéo) pour l'URL Cloudinary
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            // Si la réponse n'est pas OK (ex: 400, 500), tenter de lire le message d'erreur de Cloudinary
            const errorData = await response.json().catch(() => ({ error: { message: 'Erreur inconnue de Cloudinary' } }));
            throw new Error(errorData.error.message || `Erreur réseau ou serveur Cloudinary: ${response.status}`);
        }

        const data = await response.json();
        // Retourner les informations nécessaires pour l'affichage
        return { success: true, url: data.secure_url, resource_type: data.resource_type, filename: file.name };
    } catch (error) {
        console.error(`Erreur lors de l'upload de ${file.name}:`, error);
        // Rejeter la promesse pour que Promise.allSettled puisse la capturer
        throw { success: false, error: error.message, filename: file.name };
    }
}

/**
 * Affiche le média uploadé (image ou vidéo) dans la grille.
 * @param {string} url L'URL du média.
 * @param {string} type Le type de ressource ('image' ou 'video').
 */
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
        video.autoplay = false; // Ne pas lancer toutes les vidéos en même temps
        video.muted = true; // Mute par défaut pour l'autoplay si vous le mettez
        video.preload = 'metadata'; // Charger juste les métadonnées pour un affichage rapide
        uploadedMediaGrid.appendChild(video);
    }
}