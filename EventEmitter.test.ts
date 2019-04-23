import {EmitterInterface} from './EmitterInterface';
import {eventEmitter, EventEmitter, initEmitter} from './EventEmitter';

interface Base extends EventEmitter<BaseEvents> {}

interface BaseEvents
{
	date(year: number, month: number, day: number): void;
	void(): void;
}

interface Extension extends EventEmitter<ExtensionEvents> {}

interface ExtensionEvents extends BaseEvents
{
	string(string: string): void;
}

@eventEmitter
class Base
{ public constructor () { initEmitter(this); } }

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;

function baseEmitter<TBaseCtor extends new (...a: any[])=> any>(ctor: TBaseCtor){
  return ctor as (new (...a: ConstructorParameters<TBaseCtor>) => Omit<InstanceType<TBaseCtor>, keyof EmitterInterface<{}>>)
}

class Extension extends baseEmitter(Base) {}

describe('EventEmitter', function () {
	it('can emit events that trigger registered handlers', async function () {
		const o = new Base();
		const voidHandler = jasmine.createSpy('voidHandler');

		o.on('void', voidHandler);
		expect(voidHandler).not.toHaveBeenCalled();

		await o.emit('void');
		expect(voidHandler).toHaveBeenCalledTimes(1);

		await o.emit('void');
		expect(voidHandler).toHaveBeenCalledTimes(2);

		await o.emit('void');
		await o.emit('void');
		await o.emit('void');
		expect(voidHandler).toHaveBeenCalledTimes(5);

		o.off('void', voidHandler);
		await o.emit('void');
		await o.emit('void');
		await o.emit('void');
		expect(voidHandler).toHaveBeenCalledTimes(5);

		o.on('void', voidHandler);
		await o.emit('void');
		await o.emit('void');
		expect(voidHandler).toHaveBeenCalledTimes(7);

		const dateHandler = jasmine.createSpy('dateHandler');
		o.on('date', dateHandler);
		expect(dateHandler).not.toHaveBeenCalled();

		await o.emit('date', 1970, 1, 1);
		expect(dateHandler).toHaveBeenCalledTimes(1);
		expect(dateHandler).toHaveBeenCalledWith(1970, 1, 1);

		await o.emit('date', 1970, 1, 1);
		await o.emit('void');
		await o.emit('void');
		await o.emit('date', 1970, 1, 1);
		await o.emit('date', 2000, 7, 2);
		expect(voidHandler).toHaveBeenCalledTimes(9);
		expect(dateHandler).toHaveBeenCalledTimes(4);
		expect(dateHandler).toHaveBeenCalledWith(2000, 7, 2);

		o.off('void');
		await o.emit('date', 2008, 3, 20);
		await o.emit('void');
		expect(voidHandler).toHaveBeenCalledTimes(9);
		expect(dateHandler).toHaveBeenCalledTimes(5);
		expect(dateHandler).toHaveBeenCalledWith(2008, 3, 20);

		o.on('void', voidHandler);
		await o.emit('void');
		await o.emit('void');
		o.off();

		await o.emit('void');
		await o.emit('void');
		await o.emit('date', 1970, 1, 1);
		await o.emit('date', 2000, 7, 2);
		expect(voidHandler).toHaveBeenCalledTimes(11);
		expect(dateHandler).toHaveBeenCalledTimes(5);
		expect(dateHandler).toHaveBeenCalledWith(2008, 3, 20);
	});

	it('supports high and low priority listeners', async function () {
		const o = new Base();
		const voidHandlerHi = jasmine.createSpy('voidHandlerHi');
		const voidHandlerLo = jasmine.createSpy('voidHandlerLo');
		const voidHandlerMe = jasmine.createSpy('voidHandlerMe');

		o.addPassiveListener('void', voidHandlerLo);
		o.addListener('void', voidHandlerMe);
		o.prependListener('void', voidHandlerHi);

		await o.emit('void');
		expect(voidHandlerHi).toHaveBeenCalledTimes(1);
		expect(voidHandlerLo).toHaveBeenCalledTimes(1);
		expect(voidHandlerMe).toHaveBeenCalledTimes(1);

		expect(voidHandlerHi).toHaveBeenCalledBefore(voidHandlerMe);
		expect(voidHandlerMe).toHaveBeenCalledBefore(voidHandlerLo);
	});

	it('supports extensions with own events', async function () {
		const o = new Extension();
		const voidHandler = jasmine.createSpy('voidHandler');
		const stringHandler = jasmine.createSpy('stringHandler');

		o.on('void', voidHandler);
		o.on('string', stringHandler);

		o.emit('void');
		o.emit('string', 'apple');

		expect(voidHandler).toHaveBeenCalledTimes(1);
		expect(stringHandler).toHaveBeenCalledTimes(1);
		expect(stringHandler).toHaveBeenCalledWith('apple');
	});
});
