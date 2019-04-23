export type UnionToIntersection<U> =
	(U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

type AddParameters<ListenersT, EventT> =
    ListenersT extends (...args: infer ArgsT) => void
		? (event: EventT, ...args: ArgsT) => Promise<boolean>
		: never;

type EmitSignatures<ListenersT> =
	{ [EventT in keyof ListenersT]: AddParameters<ListenersT[EventT], EventT> };
type EmitAll<ListenersT> = UnionToIntersection<EmitSignatures<ListenersT>[keyof ListenersT]>

type ListenerActionSignatures<ListenersT, ReturnT> =
	{ [EventT in keyof ListenersT]: (event: EventT, listener: ListenersT[EventT]) => ReturnT };
type ListenerActionAll<ListenersT, ReturnT> =
	UnionToIntersection<ListenerActionSignatures<ListenersT, ReturnT>[keyof ListenersT]>;

type OffSignatures<ListenersT, ReturnT> =
	{ [EventT in keyof ListenersT]: (event?: EventT, listener?: ListenersT[EventT]) => ReturnT };
type OffAll<ListenersT, ReturnT> =
	UnionToIntersection<OffSignatures<ListenersT, ReturnT>[keyof ListenersT]>;

type OnSignatures<ListenersT, ReturnT> =
	{ [EventT in keyof ListenersT]: (event: EventT, listener: ListenersT[EventT],
		type?: ListenerType | boolean) => ReturnT };
type OnAll<ListenersT, ReturnT> =
	UnionToIntersection<OnSignatures<ListenersT, ReturnT>[keyof ListenersT]>;

export const enum ListenerType
{ ACTIVE, PASSIVE, EARLY }

export interface EventListener<ListenersT>
{ (this: EmitterInterface<ListenersT>, ...args: any[]): void; }

/**
	Simple but powerful event system inspired by the original Node.js event system. In addition to the support for simple event name strings along with arbitrary arguments as known from the Node.js event system, Evit supports the use of event objects. These enable event cancellation and the possibility to let listeners operate on event data (e.g. for collecting values).

    `ListenersT` is a type or interface with function signatures assigned to event names. All `EmitterInterface` method signatures provide type hinting based on `ListenersT`.
*/
export interface EmitterInterface<ListenersT>
{
    /** Alias for `on`. */
	addListener: OnAll<ListenersT, this>;

    /** Shortcut for `on` with `type = ListenerType.PASSIVE`. */
	addPassiveListener: ListenerActionAll<ListenersT, this>;

    /**
        Should only be used from within the `EmitterInterface`.
        <=  event : string - name
        ''  args : @List - event values matching the respective signature from `ListenersT`
        =>  called : Promise<boolean> - whether there was at least one listener to call
    */
	emit: EmitAll<ListenersT>;

    /**
        Removes one or more event listeners.
        <=  event [*] : string - if left out, all listeners for all events will be removed; if set,
                the removed set is reduced to event handler(s) for the event specified
        ''  listener [*] - if left out, all listeners for the specified `event` will be removed; if
                set, only the listener specified will be removed; in the latter case this must be a referene to the original listener passed to `on` (or one of its aliases)
        =>  this
    */
	off: OffAll<ListenersT, this>;

	/**
		Adds an event listener.
		<=	eventName - to listen to
		''	listener
		''	type :
				| ListenerType.ACTIVE - normal listener; first added, first called
				| ListenerType.EARLY - listener will be prepended and thus called before all other
					previously registered listeners
				| ListenerType.PASSIVE - listener will be called after all active and early
					listeners; this should be used for listeners, which do not cancel events, but require to know, whether an event is cancelled by another listener
				| true [[deprecated]] - legacy feature; same as EARLY
				| false [[deprecated]] - legacy feature; same as ACTIVE
		=>	this
	*/
	on: OnAll<ListenersT, this>;

    /** Shortcut for `on` with `type = ListenerType.EARLY`. */
	prependListener: ListenerActionAll<ListenersT, this>;

    /** Shortcut for `off` with `listener` left out. */
	removeAllListeners(event?: keyof ListenersT): this;

    /** Alias for `off`. */
	removeListener: OffAll<ListenersT, this>;
}
