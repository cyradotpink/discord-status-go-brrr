#!/usr/bin/env node

const https = require('https')
const fs = require('fs')
const process = require('process')
const path = require('path')

var dryRun = true // Prevent the script from actually making any discord API requests

var configPath
var config
if (!fs.existsSync(__dirname + '/../state')) fs.mkdirSync(__dirname + '/../state')
try {
    try {
        configPath = path.resolve(process.argv[2])
    } catch (err) {
        configPath = fs.readFileSync(__dirname + '/../state/configpath.txt').toString().trim()
    }
    config = JSON.parse(fs.readFileSync(configPath).toString())
    fs.writeFileSync(__dirname + '/../state/configpath.txt', configPath)
} catch (err) {
    console.error(err)
    throw new Error('Configuration could not be loaded.')
}

// A discord authorization token
const authorization = config.authorization ||
    (() => { throw new Error('No authorization token provided') })()

// Path to the closed captions JSON
var timedTextDir = config.timedTextDir ||
    (() => { throw new Error('No timedtext directory provided') })()
timedTextDir = path.normalize(path.dirname(configPath) + '/' + timedTextDir)

const progressJsonPath = __dirname + '/../state/progress.json'
const parsersDir = __dirname + '/parsers'

const updateStatus = (text) => {
    if (dryRun) return new Promise(resolve => { resolve([200, {}]) })
    return new Promise((resolve, reject) => {
        const options = {
            'method': 'PATCH',
            'hostname': 'discord.com',
            'path': '/api/v8/users/@me/settings',
            'headers': {
                'authorization': authorization,
                'content-type': 'application/json',
            },
            'timeout': 5000
        }
        var req = https.request(options, (res) => {
            var data = ''
            res.on('data', d => data += d)
            res.on('end', () => resolve([res.statusCode, data]))
            res.on('error', e => reject(e))
        })
        req.on('error', e => reject(e))
        req.on('timeout', () => reject(new Error('Timeout')))
        req.write(JSON.stringify({
            custom_status: {
                text: text,
                expires_at: (new Date(Date.now() + 60 * 1000)).toISOString(),
            }
        }))
        req.end()
    })
}

var currentCcName = ''
var events = []
var eventIndex = 0

const selectParser = (ccPath) => {
    var fileName = ccPath.match(/\/?(?<name>[^\/]*)$/).groups.name
    var parserNames = fs.readdirSync(parsersDir)
    for (let parserName of parserNames) {
        try {
            var regexB64 = parserName.match(/;(?<pattern>.*)\./).groups.pattern
            var regexPattern = Buffer.from(regexB64, 'base64').toString('utf8')
            if (fileName.match(new RegExp(regexPattern))) {
                return parserName
            }
        } catch (err) {}
    }
    return null
}

const parseEvents = (fileName) => {
    const parserName = selectParser(fileName)
    if (!parserName) return null
    const parse = require(parsersDir + '/' + parserName)
    return parse(fs.readFileSync(fileName).toString())
}

const setNextEvents = () => {
    eventIndex = 0
    return new Promise(async(resolve) => {
        var set = false
        var timedTextFiles = fs.readdirSync(timedTextDir)
        var currentCcIndex = timedTextFiles.indexOf(currentCcName)

        while (true) {
            var timedTextFiles = fs.readdirSync(timedTextDir)
            for (let i = 0; i < timedTextFiles.length; i++) {
                currentCcName = timedTextFiles[(currentCcIndex + i + 1) % timedTextFiles.length]
                events = parseEvents(timedTextDir + '/' + currentCcName)
                if (events) {
                    resolve()
                    set = true
                    break
                }
            }
            if (set) break
            currentCcIndex = -1
            console.log('No parsable file found. Retrying in 10')
            await new Promise(resolve => setTimeout(resolve, 10000))
        }
    })
}


const main = async() => {
    try {
        var progress
        if (process.argv[3]) {
            progress = [0, process.argv[3]]
            fs.writeFileSync(JSON.stringify(progress), progressJsonPath)
            console.log('Starting with specified file.')
        } else {
            var progress = JSON.parse(fs.readFileSync(progressJsonPath).toString())
            eventIndex = progress[0]
            currentCcName = progress[1]
            events = parseEvents(timedTextDir + '/' + currentCcName)
            events[eventIndex]
            console.log('Continuing.\n')
        }
    } catch (e) {
        console.log('Beginning with first file.\n')

        currentCcName = ''
        await setNextEvents()
    }

    while (true) {
        if (eventIndex >= events.length) {
            // finishedCallback()
            await setNextEvents()
            continue
        }

        console.log('--', currentCcName, '/', eventIndex, 'of', events.length - 1, '--')

        fs.writeFileSync(progressJsonPath, JSON.stringify([eventIndex, currentCcName]))

        var event = events[eventIndex]
        var duration
        try {
            duration = events[eventIndex + 1].startMs - event.startMs
        } catch (e) {
            duration = event.durationMs
        }
        console.log('Duration:', duration)

        // duration = 0 // for testing

        var text = event.text.replace(/\n/g, ' ').trim().slice(0, 128)
        console.log('Text:', text)

        try {
            var res = await updateStatus(text)
            if (res[0] !== 200) {
                console.log(res[0], res[1])
                console.log('Failed at:', (new Date()).toString())
                if (res[0] >= 500) {
                    console.log('Retrying in 2 minutes')
                    await new Promise(resolve => setTimeout(resolve, 120 * 1000))
                } else {
                    console.log('\nExiting.')
                    break
                }
            } else {
                console.log('Success at:', (new Date()).toString(), '\n')
                await new Promise(resolve => setTimeout(resolve, duration))
                eventIndex++
            }
        } catch (err) {
            console.error(err)
            console.log('Error at:', (new Date()).toString(), '\n')
            console.log('Retrying in 30 seconds')
            await new Promise(resolve => setTimeout(resolve, 30000))
        }
    }
}

main()