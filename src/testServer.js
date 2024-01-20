const fastify = require('fastify')();
const fs = require('fs');


// Register the fastify-multipart plugin
const path = require('path');

// Define a function to check permission
const hasPermission = (request) => {
    // Implement your permission check logic here
    // For example, check if the user has the necessary permissions to upload a file
    return false; // Replace with your logic
};

const multer = require('fastify-multer');

fastify.register(multer.contentParser)
// Define a function to customize the saving directory
const getSavingDirectory = (request, file, cb) => {
    fs.mkdir("upload", {recursive: true}, () => cb(null, "upload"))

};

// Configure multer for file uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: getSavingDirectory,
        filename: (request, file, cb) => {
            cb(null, Date.now() + '-' + file.originalname);
        },
    }),
    limits: {
        fileSize: 5 * 1024 * 1024, // Max file size (5 MB in this example)
    },
});
fastify.post('/upload', {preHandler: upload.single('file')}, async (request, reply) => {
    const file = request.file;

    if(!hasPermission()){
        reply.code(401).send("Unauthorized baby")
    }
    if (!file) {
        return reply.code(400).send({error: 'No file uploaded'});
    }

    // Access file properties
    const {filename, mimetype, size} = file;

    // Perform any additional processing or save the file as needed
    // In this example, the file is saved in the 'uploads' directory

    return {filename, mimetype, size};
});

// Start the server
fastify.listen({port: 80, host: "0.0.0.0"}, (err, address) => {
    if (err) throw err;
    console.log(`Server listening on ${address}`);
});