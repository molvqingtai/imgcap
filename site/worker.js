import { defineProxy } from './vendor/comctx.js'
import { compress } from './engine.js'

/**
 * comctx needs a thin adapter per context. Inside a worker the global
 * `self` already speaks postMessage, so the adapter is three lines.
 */
class WorkerAdapter {
  constructor(scope, name) {
    this.scope = scope
    this.name = name
  }

  sendMessage = (message, transfer) => {
    this.scope.postMessage(message, transfer)
  }

  onMessage = (callback) => {
    const handler = (event) => callback(event.data)
    this.scope.addEventListener('message', handler)
    return () => this.scope.removeEventListener('message', handler)
  }
}

/**
 * The provider side. `compress` is the only method the page can call;
 * the file blob goes over structured clone, never over the network.
 */
const [provide] = defineProxy(
  () => ({
    async compress(file, settings) {
      return compress(file, settings)
    }
  }),
  {
    namespace: 'imgcap:compress',
    heartbeatInterval: 250,
    heartbeatTimeout: 3 * 60 * 1000,
    transfer: true
  }
)

provide(new WorkerAdapter(self, 'imgcap-worker'))
