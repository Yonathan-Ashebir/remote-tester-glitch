const fastify = require('fastify')();
const fastifyMultipart = require('@fastify/multipart');
const fs = require('fs');

// Register the fastify-multipart plugin
fastify.register(fastifyMultipart);

// Define a route for file uploads
fastify.post('/upload', async (request, reply) => {
    let res = await new Promise((resolve) => {
        setTimeout(() => resolve("HI"), 100000)
    })

    reply.send(res)
});

// Start the server
fastify.listen({port: 80, host: "0.0.0.0"}, (err, address) => {
    if (err) throw err;
    console.log(`Server listening on ${address}`);
});