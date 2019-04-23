export class Event
{
	public static isCancellable(that: any): that is CancellableEvent
	{ return that instanceof Event && (<any> that).cancellable; }

	public constructor(
		public readonly name: string
	)
	{}
}

export interface CancellableEvent extends Event
{
	cancellable: true;
	cancelled: boolean;
}
