import {Event} from './Event';
import {EmitterInterface, EventListener, ListenerType} from './EmitterInterface';

/** Set of `EventListener`s to map to an event name. */
interface EventListenerSet
{
	listeners: EventListener<any>[];
	passiveIdx: number;
}

/** Set of default events every emitter mixing in `DefaultEventEmitter` supports. */
interface Events<ListenersT>
{
	error: (error: any) => void;
	newListener:
		<EventT extends keyof ListenersT>(event: EventT, listener: ListenersT[EventT]) => void;
	removeListener:
		<EventT extends keyof ListenersT>(event: EventT, listener: ListenersT[EventT]) => void;
}

/** Adds the default events from `Events` to the ones introduced with `ListenersT`. */
type Listeners<ListenersT> = ListenersT & Events<ListenersT>;

/** Shortcut for all possible event names. Specifies that they are strings, too. */
type EventName<ListenersT> = keyof Listeners<ListenersT> & string;

/**
	Provides a listener type ensuring the listener is in the `ListenersT` map and has the form of an `EventListener` function.
*/
type Listener<ListenersT, EventT extends EventName<ListenersT>> =
	Listeners<ListenersT>[EventT] & EventListener<Listeners<ListenersT>>;

/** Main `EventEmitter` interface type to use for custom emitter classes' `implements` clause. */
export type EventEmitter<ListenersT> = EmitterInterface<Listeners<ListenersT>>;

/**
	The `DefaultEventEmitter` contains all functionality required to fully implement the `EmitterInterface`. It is supposed to be mixed into the class that should be able to emit events. At some point, preferably in the constructor, each object of the emitter class must be passed to `DefaultEventEmitter.initialize` once to setup all required properties.
*/
class DefaultEventEmitter<ListenersT>
{
	/** Can be used to initialize objects having this class mixed in. */
	public static initialize(object: any)
	{ object.listenerMap = {}; }

	public static mixin(object: any)
	{
		// mixin implementations
		object.prototype.addPassiveListenerImpl =
			DefaultEventEmitter.prototype.addPassiveListenerImpl;
		object.prototype.emitImpl = DefaultEventEmitter.prototype.emitImpl;
		object.prototype.offImpl = DefaultEventEmitter.prototype.offImpl;
		object.prototype.onImpl = DefaultEventEmitter.prototype.onImpl;
		object.prototype.prependListenerImpl = DefaultEventEmitter.prototype.prependListenerImpl;

		// mixin prettily named methods
		object.prototype.addListener = object.prototype.on = DefaultEventEmitter.prototype.onImpl;
		object.prototype.addPassiveListener = DefaultEventEmitter.prototype.addPassiveListenerImpl;
		object.prototype.emit = DefaultEventEmitter.prototype.emitImpl;
		object.prototype.prependListener = DefaultEventEmitter.prototype.prependListenerImpl;
		object.prototype.removeListener = object.prototype.off = object.prototype.removeAllListeners
			= DefaultEventEmitter.prototype.offImpl;
	}

	private listenerMap: Record<string, EventListenerSet> = {};

	public addPassiveListenerImpl<EventT extends EventName<ListenersT>>(
		eventName: EventT, listener: Listener<ListenersT, EventT>): this
	{ return this.onImpl(eventName, listener, ListenerType.PASSIVE); }

	protected async emitImpl(eventName: EventName<ListenersT>, ...args: any[]): Promise<boolean>
	{
		// take care of Event objects
		const first = args[0];
		const event = Event.isCancellable(first) ? first : undefined;
		const set = this.listenerMap[eventName];

		// return false, if no listeners have been registered for the event
		if (!set)
		{ return false; }

		// invoke the listeners
		for (const listener of set.listeners)
		{
			try
			{ await listener.apply(this, args); }
			catch (error)
			{
				const errorSet = this.listenerMap['error'];
				if (eventName === 'error' || !errorSet || errorSet.listeners.length === 0)
				{ throw error; }
				else
				{ this.emitImpl('error', error); }
			}

			if (event && event.cancelled)
			{ break; }
		}

		return true;
	}

	protected offImpl<EventT extends EventName<ListenersT>>(
		eventName?: EventT, listener?: Listener<ListenersT, EventT>): this
	{
		// remove all listeners, if no arguments given
		if (!eventName)
		{
			for (const event in this.listenerMap)
			{
				const listeners = this.listenerMap[event].listeners;
				for (let i = 0; i < listeners.length; ++i)
				{ this.emitImpl('removeListener', event, listeners[i]); }
			}

			this.listenerMap = {};
			return this;
		}

		// remove all listeners for one event, if no specific one given
		if (!listener)
		{
			const set = this.listenerMap[eventName];
			if (!set)
			{ return this; }

			const listeners = set.listeners;
			for (let i = 0; i < listeners.length; ++i)
			{ this.emitImpl('removeListener', eventName, listeners[i]); }

			delete this.listenerMap[eventName];
			return this;
		}

		// get a reference to the listener list for the event
		const set = this.listenerMap[eventName];
		if (!set)
		{ return this; }

		// remove the listener from the list, if it is in it
		const index = set.listeners.indexOf(<any> listener);
		if (index !== -1)
		{
			this.emitImpl('removeListener', eventName, set.listeners.splice(index, 1)[0]);
			if (set.listeners.length === 0)
			{ delete this.listenerMap[eventName]; }
			else if (index < set.passiveIdx)
			{ --set.passiveIdx; }
		}

		return this;
	}

	protected onImpl<EventT extends EventName<ListenersT>>(eventName: EventT,
		listener: Listener<ListenersT, EventT>, type: ListenerType | boolean = ListenerType.ACTIVE): this
	{
		// legacy workaround; former, `type` was a boolean argument named `prepend`
		if (type === true)
		{ type = ListenerType.EARLY; }
		else if (type === false)
		{ type = ListenerType.ACTIVE; }

		// add a listener list, if none present; add the listener
		const set = this.listenerMap[eventName];
		if (!set)
		{
			this.listenerMap[eventName] = {
				listeners: [listener],
				passiveIdx: type === ListenerType.PASSIVE ? 0 : 1,
			};
		}
		else
		{
			switch (type)
			{
				case ListenerType.ACTIVE:
					set.listeners.splice(set.passiveIdx, 0, listener);
					++set.passiveIdx;
					break;
				case ListenerType.EARLY:
					set.listeners.unshift(listener);
					++set.passiveIdx;
					break;
				case ListenerType.PASSIVE:
					set.listeners.push(listener);
					break;
			}
		}

		// emit a newListener event
		this.emitImpl('newListener', eventName, listener);

		return this;
	}

	protected prependListenerImpl<EventT extends EventName<ListenersT>>(
		eventName: EventT, listener: Listener<ListenersT, EventT>): this
	{ return this.onImpl(eventName, listener, true); }
}

/** Convenience decorator for mixing in the `DefaultEventEmitter`. */
export const eventEmitter = DefaultEventEmitter.mixin;

/** Shortcut for initializing an event emitter. */
export const initEmitter = DefaultEventEmitter.initialize;
