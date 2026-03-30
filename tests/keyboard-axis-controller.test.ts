import { KeyboardAxisController } from '../src/keyboard-axis-controller.js';

describe('KeyboardAxisController', () => {
  it('ramps while a hold key remains pressed', () => {
    const controller = new KeyboardAxisController({
      holdBindings: {
        KeyA: -1,
        KeyD: 1,
      },
      centerBindings: ['KeyW', 'KeyS'],
      holdUnitsPerSecond: 1,
      snapUnitsPerSecond: 2,
      centerUnitsPerSecond: 2,
    });

    expect(controller.handleKeyDown('KeyD', 100)).toBe(true);
    expect(controller.update(0.25)).toBe(true);
    expect(controller.getValue()).toBeCloseTo(0.25, 5);

    expect(controller.update(0.75)).toBe(true);
    expect(controller.getValue()).toBeCloseTo(1, 5);

    expect(controller.handleKeyUp('KeyD')).toBe(true);
    expect(controller.update(0.25)).toBe(false);
    expect(controller.getValue()).toBeCloseTo(1, 5);
  });

  it('double tapping a steering key snaps to the side in 500 ms', () => {
    const controller = new KeyboardAxisController({
      holdBindings: {
        KeyA: -1,
        KeyD: 1,
      },
      centerBindings: ['KeyW', 'KeyS'],
      holdUnitsPerSecond: 1,
      snapUnitsPerSecond: 2,
      centerUnitsPerSecond: 2,
    });

    controller.handleKeyDown('KeyD', 100);
    controller.handleKeyUp('KeyD');
    controller.handleKeyDown('KeyD', 250);

    controller.update(0.25);
    expect(controller.getValue()).toBeCloseTo(0.5, 5);

    controller.update(0.25);
    expect(controller.getValue()).toBeCloseTo(1, 5);
  });

  it('pressing a center key moves back to zero in 500 ms from full lock', () => {
    const controller = new KeyboardAxisController({
      holdBindings: {
        KeyA: -1,
        KeyD: 1,
      },
      centerBindings: ['KeyW', 'KeyS'],
      holdUnitsPerSecond: 1,
      snapUnitsPerSecond: 2,
      centerUnitsPerSecond: 2,
    });

    controller.setValue(-1);
    expect(controller.handleKeyDown('KeyW', 100)).toBe(true);

    controller.update(0.25);
    expect(controller.getValue()).toBeCloseTo(-0.5, 5);

    controller.update(0.25);
    expect(controller.getValue()).toBeCloseTo(0, 5);
  });

  it('exposes the same centering motion for non-keyboard triggers', () => {
    const controller = new KeyboardAxisController({
      holdBindings: {
        KeyA: -1,
        KeyD: 1,
      },
      centerBindings: ['KeyW', 'KeyS'],
      holdUnitsPerSecond: 1,
      snapUnitsPerSecond: 2,
      centerUnitsPerSecond: 2,
    });

    controller.setValue(1);
    controller.center();

    controller.update(0.25);
    expect(controller.getValue()).toBeCloseTo(0.5, 5);

    controller.update(0.25);
    expect(controller.getValue()).toBeCloseTo(0, 5);
  });

  it('supports throttle double tap on Numpad2 for full astern', () => {
    const controller = new KeyboardAxisController({
      holdBindings: {
        Numpad2: -1,
        Numpad8: 1,
      },
      doubleTapBindings: {
        Numpad2: -1,
        Numpad8: 1,
      },
      centerBindings: ['Numpad5'],
      holdUnitsPerSecond: 1,
      snapUnitsPerSecond: 2,
      centerUnitsPerSecond: 2,
    });

    controller.handleKeyDown('Numpad2', 100);
    controller.handleKeyUp('Numpad2');
    controller.handleKeyDown('Numpad2', 250);

    controller.update(0.5);
    expect(controller.getValue()).toBeCloseTo(-1, 5);
  });

  it('cancels opposing held keys instead of drifting', () => {
    const controller = new KeyboardAxisController({
      holdBindings: {
        Numpad2: -1,
        Numpad8: 1,
      },
      doubleTapBindings: {
        Numpad2: -1,
        Numpad8: 1,
      },
      centerBindings: ['Numpad5'],
      holdUnitsPerSecond: 1,
      snapUnitsPerSecond: 2,
      centerUnitsPerSecond: 2,
    });

    controller.handleKeyDown('Numpad8', 100);
    controller.handleKeyDown('Numpad2', 150);

    expect(controller.update(0.5)).toBe(false);
    expect(controller.getValue()).toBeCloseTo(0, 5);
  });
});
