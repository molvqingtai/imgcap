
//#region src/protocol.d.ts
declare const MESSAGE_TYPE: {
  readonly APPLY: "apply";
  readonly CALLBACK: "callback";
  readonly PING: "ping";
  readonly PONG: "pong";
};
declare const MESSAGE_SENDER_TYPE: {
  readonly PROVIDER: "provider";
  readonly INJECTOR: "injector";
};
type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];
type MessageSenderType = (typeof MESSAGE_SENDER_TYPE)[keyof typeof MESSAGE_SENDER_TYPE];
interface MessageSender {
  readonly type: MessageSenderType;
  readonly name?: string;
}
type MessageMeta = object;
interface Message<T extends MessageMeta = MessageMeta> {
  readonly type: MessageType;
  readonly id: string;
  readonly path: string[];
  readonly sender: MessageSender;
  readonly callbackIds?: string[];
  readonly args?: any[];
  readonly data?: any;
  readonly error?: string;
  readonly meta: T;
  readonly namespace: string;
  readonly timeStamp: number;
}
declare const checkMessage: (message?: Partial<Message>) => boolean;
//#endregion
//#region src/comctx.d.ts
type MaybePromise<T> = T | Promise<T>;
type OffMessage = () => MaybePromise<void>;
type SendMessage<T extends MessageMeta = MessageMeta> = (message: Message<T>, transfer: Transferable[]) => MaybePromise<void>;
type OnMessage<T extends MessageMeta = MessageMeta> = (callback: (message?: Partial<Message<T>>) => void) => MaybePromise<OffMessage | void>;
interface Adapter<T extends MessageMeta = MessageMeta> {
  name?: string;
  sendMessage: SendMessage<T>;
  onMessage: OnMessage<T>;
}
type Context<T extends Record<string, any> = Record<string, any>> = (...args: any[]) => T;
interface Options {
  namespace?: string;
  heartbeatCheck?: boolean;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  transfer?: boolean;
  debug?: boolean | DebugLevel;
}
type DebugLevel = 'message' | 'event';
declare const isProxy: (target: any) => boolean;
/**
 * Creates a pair of proxies for the provider (provide) and injector (inject) to facilitate method calls and callbacks across communication layers.
 *
 * @param context - A factory function that returns the target object to be proxied:
 *   - For the provider: Returns an object containing the actual method implementations that handle remote calls from injectors.
 *   - For the injector: Returns an object used for TypeScript type inference (actual calls are made through RPC proxy).
 * @param options - Configuration options:
 *   - namespace: The communication namespace used to isolate messages between different proxy instances (default is '__comctx__').
 *   - heartbeatCheck: Enable provider readiness check (default: true).
 *   - heartbeatInterval: The frequency at which to request heartbeats in milliseconds (default: 300).
 *   - heartbeatTimeout: Max wait time for heartbeat response in milliseconds (default: 1000).
 *   - transfer: Whether to use transferable objects for message transfer (default is false).
 *   - debug: Whether to log debug output. Use true for message and event logs, 'message' for adapter-level message logs, and 'event' for effective Comctx event logs (default is false).
 * @returns Returns a tuple containing two elements:
 *   - [0] provideProxy: Accepts an adapter and creates a provider proxy.
 *   - [1] injectProxy: Accepts an adapter and creates an injector proxy.
 *
 * @example
 * const [provide, inject] = defineProxy(() => ({
 *   add: (a, b) => a + b
 * }), { namespace: 'math' })
 *
 * // Provider
 * provide(providerAdapter)
 *
 * // Injector
 * const math = inject(injectorAdapter)
 * await math.add(2, 3) // 5
 */
declare const defineProxy: <T extends Context>(context: T, options?: Options) => readonly [<M extends MessageMeta = object>(adapter: Adapter<M>, ...args: Parameters<T>) => ReturnType<T>, <M extends MessageMeta = object>(adapter: Adapter<M>) => ReturnType<T>];
//#endregion
export { Adapter, Context, DebugLevel, MESSAGE_SENDER_TYPE, MESSAGE_TYPE, Message, MessageMeta, MessageSender, MessageSenderType, MessageType, OffMessage, OnMessage, Options, SendMessage, checkMessage, defineProxy, isProxy };