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
const unlinkFile = util.promisify(fs.unlink)
const fileExists = util.promisify(fs.exists)
const renameFile = util.promisify(fs.rename)
const seo = require("./seo.json");
const multer = require('fastify-multer')
const zip = require('node-stream-zip')
const lockfile = require('proper-lockfile')

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
const authorize = (request) => {
    const authorization = request.headers['authorization']
    if (!authorization || authorization !== process.env['UPLOAD_TOKEN']) throw new Error("Invalid credentials")
}

/* configure uploads */
const upload = multer({
    limits: {
        fileSize: 50 * 1024 * 1024, // Max file size (5 MB in this example)
    }
})

const {
    MODULE_FILE,
    LOCK_FILE,
    INFO_FILE
} = require("./constants");
const {
    mLog,
    MY_LOG_ERROR,
    MY_LOG_DEBUG,
    getValidatedModuleName
} = require("./include");

if (seo.url === "glitch-default") {
    seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

fastify.get("/:module", async (request, reply) => {
    mLog(MY_LOG_DEBUG, `Get request from ${request.socket.remoteAddress}:${request.socket.remotePort} => ${request.url}`)
    try {
        const moduleName = getValidatedModuleName(request.params['module'])
        const moduleDir = path.join(path.parse(__dirname).dir, 'modules', moduleName);
        const moduleZip = path.join(moduleDir, MODULE_FILE)

        let stream = fs.createReadStream(moduleZip)
        stream.on('error', (e) => {
            mLog(MY_LOG_ERROR, `Could not retrieve module: ${e}`)
            reply.errorCode = 400
            reply.send("Could not retrieve module")
        })
        return reply.send(stream)
    } catch (e) {
        mLog(MY_LOG_ERROR, `Could not retrieve module: ${e}`)
        reply.errorCode = 400
        reply.send(e.message)
    }
});

fastify.get("/:module/info", async (request, reply) => {
    mLog(MY_LOG_DEBUG, `Get request from ${request.socket.remoteAddress}:${request.socket.remotePort} => ${request.url}`)

    try {
        const moduleName = getValidatedModuleName(request.params['module'])
        const moduleDir = path.join(path.parse(__dirname).dir, 'modules', moduleName);
        const moduleZip = path.join(moduleDir, MODULE_FILE)

        if (!await fileExists(moduleZip)) return ""

        const archive = new zip.async({file: moduleZip})
        const info = (await archive.entryData(INFO_FILE)).toString()
        return reply.send(info)
    } catch (e) {
        mLog(MY_LOG_ERROR, `Could not retrieve module: ${e}`)
        reply.errorCode = 400
        reply.send(e.message)
    }
});

fastify.get("/:module/revision", async (request, reply) => {
    mLog(MY_LOG_DEBUG, `Get request from ${request.socket.remoteAddress}:${request.socket.remotePort} => ${request.url}`)

    try {
        const moduleName = getValidatedModuleName(request.params['module'])
        const moduleDir = path.join(path.parse(__dirname).dir, 'modules', moduleName);
        const moduleZip = path.join(moduleDir, MODULE_FILE)

        if (!await fileExists(moduleZip)) return ""

        const archive = new zip.async({file: moduleZip})
        const info = (await archive.entryData(INFO_FILE)).toString()
        const revision = JSON.parse(info)['revision']
        return reply.send(revision)
    } catch (e) {
        mLog(MY_LOG_ERROR, `Could not retrieve module: ${e}`)
        reply.errorCode = 400
        reply.send(e.message)
    }
});

fastify.post("/upload/:module", {
    preHandler: upload.single('file')
}, async (request, reply) => {
    mLog(MY_LOG_DEBUG, `Upload request from ${request.socket.remoteAddress}:${request.socket.remotePort} => ${util.inspect(request.url)}`)

    try {
        authorize(request)
        const moduleName = getValidatedModuleName(request.params['module'])
        const moduleDir = path.join(path.parse(__dirname).dir, 'modules', moduleName);
        const moduleZip = path.join(moduleDir, MODULE_FILE)

        await util.promisify(fs.mkdir)(moduleDir, {recursive: true})
        await lockfile.lock(moduleDir, {lockFilePath: path.join(moduleDir, LOCK_FILE)})
        try {
            if (await fileExists(moduleZip)) await unlinkFile(moduleZip)
            await util.promisify(fs.writeFile)(moduleZip, request.file.buffer)
        } finally {
            lockfile.unlock(moduleDir, {lockFilePath: path.join(moduleDir, LOCK_FILE)}).then()
        }

        reply.send("File uploaded successfully");
    } catch (e) {
        mLog(MY_LOG_ERROR, `Module upload failed: ${e}`)
        reply.errorCode = 400
        reply.send(e.message)
    }
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
