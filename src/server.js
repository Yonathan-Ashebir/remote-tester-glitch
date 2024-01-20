const fastify = require("fastify")({
    logger: false,
});
const path = require("path");
const {FETCH_MODULE_HASH} = require('./constants.js')
const crypto = require('crypto')
const util = require('node:util')
const fs = require('fs')
const {pipeline} = require('node:stream')
const pump = util.promisify(pipeline)
const seo = require("./seo.json");
const multer = require('fastify-multer')

/* add plugins*/
fastify.register(multer.contentParser)

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

/* configure authorization */
const isAuthorized = (request) => {
    const authorization = request.headers['authorization']
    return authorization && authorization === process.env['UPLOAD_TOKEN']
}

/* configure uploads */
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, callback) => {
            if (!isAuthorized(req))
                callback(new Error("Unauthorized"))
            else if (!isAlphanumericUnderscore(req.query[UPLOAD_MODULE])) {
                callback(new Error("Invalid module name"))
            } else {
                const moduleDir = path.join(path.parse(__dirname).dir, 'modules', req.query[UPLOAD_MODULE]);
                fs.mkdir(moduleDir, {recursive: true}, () => callback(null, moduleDir))
            }
        },
        filename: (request, file, cb) => {
            cb(null, MODULE_FILE);
        },
    }),
    limits: {
        fileSize: 5 * 1024 * 1024, // Max file size (5 MB in this example)
    },
});


const {MODULE_FILE, UPLOAD_MODULE, HASH_FILE, MODULE, FETCH_MODULE_ZIP, HASH} = require("./constants");
const {mLog, MY_LOG_ERROR, MY_LOG_DEBUG, isAlphanumericUnderscore, doAsync} = require("./include");

if (seo.url === "glitch-default") {
    seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

/**
 * Our home page route
 *
 * Returns pages/index.hbs with data built into it
 */
fastify.get("/", async (request, reply) => {
    mLog(MY_LOG_DEBUG, `Get request from ${request.socket.remoteAddress}:${request.socket.remotePort} => ${util.inspect(request.query)}`)

    try {
        const moduleDir = path.join(path.parse(__dirname).dir, 'modules', request.query[MODULE]);
        const moduleZip = path.join(moduleDir, MODULE_FILE)
        const moduleHash = path.join(moduleDir, HASH_FILE)

        if (FETCH_MODULE_HASH in request.query) {
            let stream = fs.createReadStream(moduleHash)
            stream.on('error', (e) => {
                mLog(MY_LOG_ERROR, `Could not retrieve module hash: ${e}`)
                reply.errorCode = 400
                reply.send("Could not retrieve module hash")
            })
            return reply.send(stream)
        }

        if (FETCH_MODULE_ZIP in request.query) {
            if (HASH in request.query && (await util.promisify(fs.readFile)(moduleHash)).toString() !== request.query[HASH]) {
                mLog(MY_LOG_ERROR, `Bad hash`)
                reply.errorCode = 400
                return reply.send("Bad hash")
            }

            let stream = fs.createReadStream(moduleZip)
            stream.on('error', (e) => {
                mLog(MY_LOG_ERROR, `Could not retrieve module: ${e}`)
                reply.errorCode = 400
                reply.send("Could not retrieve module")
            })
            return reply.send(stream)
        }

        reply.send('HELLO')
    } catch (e) {
        mLog(MY_LOG_ERROR, `Could not retrieve module: ${e}`)
        reply.errorCode = 400
        reply.send("Could not retrieve module")
    }

});

/**
 * Our POST route to handle and react to form submissions
 *
 * Accepts body data indicating the user choice
 */
fastify.post("/upload", {preHandler: upload.single('file')}, async (request, reply) => {
    mLog(MY_LOG_DEBUG, `Upload request from ${request.socket.remoteAddress}:${request.socket.remotePort} => ${util.inspect(request.query)}`)


    if (UPLOAD_MODULE in request.query) {
        if (!isAuthorized(request)) {
            reply.errorCode = 401
            return reply.send("Invalid credentials")
        }

        if (!isAlphanumericUnderscore(request.query[UPLOAD_MODULE])) {
            reply.errorCode = 400
            return reply.send("Invalid module name")
        }

        try {
            const moduleDir = path.join(path.parse(__dirname).dir, 'modules', request.query[UPLOAD_MODULE]);
            await doAsync(fs.mkdir, moduleDir, {recursive: true})
            const moduleZip = path.join(moduleDir, MODULE_FILE)
            const moduleHash = path.join(moduleDir, HASH_FILE)
            const zip = fs.createReadStream(moduleZip);

            let gen = crypto.createHash("md5")
            zip.on('data', buf => {
                gen.update(buf)
            })
            zip.on('end', () => {
                fs.writeFile(moduleHash, gen.digest('hex'), (err) => {
                    if (err) mLog(MY_LOG_ERROR, "Could not write hash file")
                })
            })
            await pump(zip, fs.createWriteStream(moduleZip))

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
