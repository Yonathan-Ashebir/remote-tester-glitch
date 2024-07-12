// noinspection JSUnusedGlobalSymbols

/* load .env file */
require('dotenv').config({path: '../.env'})

const {Socket} = require("net");
const {StunRequest, decode, constants: stunConstants} = require("stun");
const fs = require("fs");

const LOG_TO_FILE = process.env['LOG_TO_FILE']

function getTCPPublicAddress(localPort, callback, closeImmediately = true) {
    const sock = new Socket()

    sock.connect({host: '212.53.40.40', port: 3478, localPort}, () => {
        const request = new StunRequest()
        // noinspection JSUnresolvedReference
        request.setType(stunConstants.STUN_BINDING_REQUEST)

        sock.on('data', buf => {
            const res = decode(buf)
            callback(res.getXorAddress())
            if (closeImmediately) sock.destroy()
        })
        sock.write(request.toBuffer())
    })
}

const MY_LOG_VERBOSE = 5
const MY_LOG_DEBUG = 4
const MY_LOG_INFO = 3
const MY_LOG_WARN = 2
const MY_LOG_ERROR = 1
const MY_LOG_WTF = 0

function mLog(level, message, tag = "Y_Tech") {
    const now = new Date()
    let output = `${now.getFullYear()}-${now.getMonth()}-${now.getDay()} ${now.toLocaleTimeString('en-US', {hour12: false})} ${level === MY_LOG_WTF ? 'W' : level === MY_LOG_DEBUG ? 'D' : level === MY_LOG_INFO ? 'I' : level === MY_LOG_WARN ? 'W' : level === MY_LOG_ERROR ? 'E' : 'V'} | ${tag}: ${message}`

    if (LOG_TO_FILE)
        fs.appendFileSync(LOG_TO_FILE.toString(), output + '\n')
    else {
        if (level < MY_LOG_WARN) console.error(output)
        else if (level === MY_LOG_WARN) console.warn(output)
        else console.log(output)
    }
}

function getValidatedModuleName(str) {
    const result = str.trim()
    if (!/^[a-zA-Z0-9_]+(.[a-zA-Z0-9_]+)*$/.test(result)) throw new Error("Invalid package name")
    return result
}

function listenAsync(emitter, event) {
    return new Promise((resolve, reject) => {
        emitter.on(event, (err, data) => {
            if (err) reject(err)
            else resolve(data)
        })
    })
}

function doAsync(call, ...args) {
    return new Promise((resolve, reject) => {
        call(...args, (err, data) => {
            if (err) reject(err)
            else resolve(data)
        })
    })
}

module.exports = {
    MY_LOG_VERBOSE,
    MY_LOG_DEBUG,
    MY_LOG_ERROR,
    MY_LOG_INFO,
    MY_LOG_WARN,
    getTCPPublicAddress,
    getValidatedModuleName,
    mLog,
    listenAsync,
    doAsync
}