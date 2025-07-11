const cloudinary = require('cloudinary').v2;
const Busboy = require('busboy');
const { Readable } = require('stream');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async(event) => {
    // AJOUTEZ CETTE LIGNE POUR DÉBOGUER
    console.log('Received HTTP Method:', event.httpMethod);

    if (event.httpMethod !== 'POST') {
        // AJOUTEZ CETTE LIGNE POUR DÉBOGUER
        console.log('Method is not POST, returning 405.');
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
        };
    }

    // ... le reste du code de la fonction (inchangé)
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: event.headers });
        const uploadedFiles = [];
        let fileCount = 0;

        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            fileCount++;
            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', async() => {
                const buffer = Buffer.concat(chunks);
                const stream = Readable.from(buffer);

                try {
                    const result = await new Promise((resolveCloudinary, rejectCloudinary) => {
                        const uploadStream = cloudinary.uploader.upload_stream({ folder: 'mariage-photos', resource_type: 'auto' }, // Ajout de resource_type: 'auto'
                            (error, result) => {
                                if (error) return rejectCloudinary(error);
                                resolveCloudinary(result);
                            }
                        );

                        stream.pipe(uploadStream);
                    });
                    uploadedFiles.push(result.secure_url);
                } catch (error) {
                    console.error('Cloudinary upload error:', error);
                    reject({
                        statusCode: 500,
                        body: JSON.stringify({ message: 'Failed to upload image to Cloudinary', error: error.message }),
                    });
                } finally {
                    fileCount--;
                    if (fileCount === 0) {
                        resolve({
                            statusCode: 200,
                            body: JSON.stringify({
                                message: 'Photos uploaded successfully!',
                                uploadedCount: uploadedFiles.length,
                                urls: uploadedFiles,
                            }),
                        });
                    }
                }
            });
        });

        busboy.on('finish', () => {
            if (uploadedFiles.length === 0 && fileCount === 0) {
                resolve({
                    statusCode: 400,
                    body: JSON.stringify({ message: 'No files uploaded.' }),
                });
            }
        });

        busboy.on('error', (err) => {
            console.error('Busboy error:', err);
            reject({
                statusCode: 500,
                body: JSON.stringify({ message: 'Error parsing form data', error: err.message }),
            });
        });

        const bodyBuffer = Buffer.from(event.body, 'base64');
        busboy.end(bodyBuffer);
    });
};