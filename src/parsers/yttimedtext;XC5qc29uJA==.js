const parseEvents = (json) => {
    var events = JSON.parse(json).events
    events = events.filter(val => val.segs && val.segs[0].utf8 && val.segs[0].utf8.trim())
    events = events.map(event => ({
        startMs: event.tStartMs,
        durationMs: event.dDurationMs,
        text: event.segs.map(seg => seg.utf8).join('')
    }))

    // console.log(events)
    return events
}

module.exports = parseEvents