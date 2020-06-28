const { EventPromise } = require('..');

const { expect } = require('chai');

describe('EventPromise', () => {
  describe('.emitter()', () => {
    it('creates an instance of the emitter builder', () => {
      const b = EventPromise.emitter();
      expect(b.constructor.name).to.equal('EmitterBuilder');
    });
  });

  describe('.timeout()', () => {
    it('creates an instance of the timer builder', () => {
      const b = EventPromise.timeout();
      expect(b.constructor.name).to.equal('TimerBuilder');
    });
  });

  describe('.interval()', () => {
    it('creates an instance of the timer builder', () => {
      const b = EventPromise.timeout();
      expect(b.constructor.name).to.equal('TimerBuilder');
    });
  });
});
