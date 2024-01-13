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

// Load and parse SEO data
const seo = require("./seo.json");
const {MODULE_FILE} = require("./constants");
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
fastify.get("/", function (request, reply) {
    const module = path.join(path.parse(__dirname).dir, 'modules', MODULE_FILE)

    mLog(MY_LOG_DEBUG,`Request from ${request.socket.remoteAddress}:${request.socket.remotePort} => ${util.inspect(request.query)}`)

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
fastify.post("/", function (request, reply) {
    // Build the params object to pass to the template
    let params = {seo: seo};

    // If the user submitted a color through the form it'll be passed here in the request body
    let color = request.body['color'];

    // If it's not empty, let's try to find the color
    if (color) {
        // ADD CODE FROM TODO HERE TO SAVE SUBMITTED FAVORITES

        // Load our color data file
        const colors = require("./colors.json");

        // Take our form submission, remove whitespace, and convert to lowercase
        color = color.toLowerCase().replace(/\s/g, "");

        // Now we see if that color is a key in our colors object
        if (colors[color]) {
            // Found one!
            params = {
                color: colors[color],
                colorError: null,
                seo: seo,
            };
        } else {
            // No luck! Return the user value as the error property
            params = {
                colorError: request.body['color'],
                seo: seo,
            };
        }
    }

    // The Handlebars template will use the parameter values to update the page with the chosen color
    return reply.view("pages/index.hbs", params);
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
