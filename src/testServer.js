const fastify = require('fastify')();
const fastifyMultipart = require('@fastify/multipart');
const fs = require('fs');

// Register the fastify-multipart plugin
fastify.register(fastifyMultipart);

// Define a route for file uploads
fastify.post('/upload', async (request, reply) => {
    const data = await request.file();

    // Ensure the 'uploads' directory exists
    if (!fs.existsSync('./uploads')) {
        fs.mkdirSync('./uploads');
    }

    // Save the file to the 'uploads' directory
    const fileName = `./uploads/${data.filename}`;
    await fs.promises.writeFile(fileName, data.file);

    reply.send({success: true, message: 'File uploaded successfully'});
});

// Start the server
fastify.listen({port: 80}, (err, address) => {
    if (err) throw err;
    console.log(`Server listening on ${address}`);
});