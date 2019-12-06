const { expect } = require('chai')
const WebSocket = require('ws')
const { promisify } = require('util')


class TimeoutError extends Error { }

const delay = (ms) => new Promise(resolve => {
  setTimeout(
    resolve,
    ms
  )
})

const timeout = (promise, ms=1000) => Promise.race([
  promise,
  delay(ms).then(() => { throw new TimeoutError() })
])

send = (ws, msg) => {
  const strMsg = JSON.stringify(msg)
  return promisify(ws.send.bind(ws))(strMsg)
}

const createServer = () => {
  const users = []
  const wss = new WebSocket.Server({ port: 8080 });
  wss.on('connection', (ws) => {
    users.push(ws)
    ws.on('message', (msg) => {
      console.log(msg, users.length)
      msg = JSON.parse(msg)
      users.filter(user => user !== ws).forEach(user => send(user, msg))
    })
  })

  return wss
}

const createClient = () => {
  const ws = new WebSocket('ws://localhost:8080');
  const client = {
    ws
  }
  return collectEvents(ws, 'open').then(()=> ws)
}

const collectEvents = (eventEmmiter, eventName, count=1, msTimeout=1000) => {
  return timeout(new Promise((resolve) => {
    const result = []
    const listener = (msg) => {
      result.push(msg)
      if(result.length === count) {
        resolve(result)
        eventEmmiter.removeListener(eventName, listener)
      }
    }
    eventEmmiter.on(eventName, listener)
  }), msTimeout)
}


const take = (ws, count) => collectEvents(ws, 'message', count)
  .then(msgs => msgs.map(m => JSON.parse(m)))

describe('utils', function() {
  it('can timeout', async () => {
    const err = await timeout(delay(2000)).catch(err => err)
    expect(err).instanceof(TimeoutError)
  })
})

describe('server', function() {
  let server
  before(() => {
    server = createServer()
  })
  after(() => {
    server.close()
  })
  it('can echo', async () => {
    const client1 = await createClient()
    const client2 = await createClient()
    const msgPromise = take(client1)
    send(client2, 'something')
    await msgPromise
  })
})
