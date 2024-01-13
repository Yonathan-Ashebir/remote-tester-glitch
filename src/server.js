const path = require("path");
const {FETCH_MODULE, FETCH_MODULE_HASH} = require('./constants.js')
const crypto = require('crypto')
const fs = require('fs')

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
    // Set this to true for detailed logging:
    logger: false,
});

// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE

// Setup our static files
fastify.register(require("@fastify/static"), {
    root: path.join(__dirname, "public"),
    prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
    engine: {
        handlebars: require("handlebars"),
    },
});

/* load multipart plugin */
fastify.register(require("@fastify/multipart"))

const seo = require("./seo.json");
const {MODULE_FILE, UPLOAD_MODULE} = require("./constants");
const {mLog, MY_LOG_ERROR, MY_LOG_DEBUG} = require("./include");
const util = require("util");
if (seo.url === "glitch-default") {
    seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

/**
 * Our home page route
 *
 * Returns pages/index.hbs with data built into it
 */
fastify.get("/", (request, reply) => {
    const module = path.join(path.parse(__dirname).dir, 'modules', MODULE_FILE)

    mLog(MY_LOG_DEBUG, `Get request from ${request.socket.remoteAddress}:${request.socket.remotePort} => ${util.inspect(request.query)}`)

    if (FETCH_MODULE_HASH in request.query) {
        let gen = crypto.createHash("md5")
        try {
            let stream = new fs.createReadStream(module)
            stream.on('data', (data) => {
                gen.update(data)
            })

            stream.on('error', e => {
                mLog(MY_LOG_ERROR, "Module not found: " + e)
                reply.errorCode = 404
                reply.send("No module found")
            })

            stream.on('end', () => {
                reply.send(gen.digest('hex'))
            })

        } catch (e) {
            mLog(MY_LOG_ERROR, "Module not found: " + e)
            reply.errorCode = 404
            reply.send("No module found")
        }
        return
    }

    if (FETCH_MODULE in request.query) {
        try {
            let stream = fs.createReadStream(module)
            stream.on('error', e => {
                mLog(MY_LOG_ERROR, "Module not found: " + e)
                reply.errorCode = 404
                reply.send("No module found")
            })
            reply.send(stream)
        } catch (e) {
            mLog(MY_LOG_ERROR, "Module not found: " + e)
            reply.errorCode = 404
            reply.send("No module found")
        }
        return
    }

    reply.send('HELLO')
});

/**
 * Our POST route to handle and react to form submissions
 *
 * Accepts body data indicating the user choice
 */
fastify.post("/upload", async (request, reply) => {
    mLog(MY_LOG_DEBUG, `Upload request from ${request.socket.remoteAddress}:${request.socket.remotePort} => ${util.inspect(request.query)}`)

    const module = path.join(path.parse(__dirname).dir, 'modules', MODULE_FILE)
    const authorization = request.headers['authorization']

    if (UPLOAD_MODULE in request.query) {

        if (!authorization || authorization !== process.env['UPLOAD_TOKEN']) {
            reply.errorCode = 401
            return reply.send("Invalid credentials")
        }
        try {
            const data = await request.file();
            data.file.pipe(fs.createWriteStream(module));
            reply.send("File uploaded successfully");
        } catch (e) {
            mLog(MY_LOG_ERROR, `Module upload failed: ${e}`)
            reply.errorCode = 400
            reply.send("Upload failed")
        }
        return
    }

    return reply.send("HELLO")
})

// Run the server and report out to the logs
fastify.listen(
    {port: process.env.PORT ? process.env.PORT : 80, host: "0.0.0.0"},
    function (err, address) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(`Your app is listening on ${address}`);
    }
);
