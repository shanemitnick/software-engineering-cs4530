import Venusian from './Venusian';
import Ship from './Ship';

const maude = new Venusian('Maude');
const harold = new Venusian('Harold');
const Waldo1 = new Venusian('Waldo');
const Waldo2 = new Venusian('Waldo');
const ship1 = new Ship([], []);
const ship2 = new Ship([maude, harold, Waldo1, Waldo2], []);
const ship3 = new Ship([maude, harold], []);
const ship4 = new Ship([harold, Waldo1], [ship1, ship2]);
const ship5 = new Ship([], [ship2, ship4, ship3]);

describe('sanity tests', () => {

  test('methods for Venusians are defined', () => {
    expect(harold.getName()).toBeDefined();
    expect(harold.getVsn()).toBeDefined();
  });

  test('methods for Ship are defined', () => {
    expect(ship1.getCrew()).toBeDefined();
    expect(ship1.getDaughters()).toBeDefined();
    expect(ship1.getSerialNumber()).toBeDefined();
    expect(ship5.totalWaldos()).toBeDefined();
    expect(ship5.removeWaldos).toBeDefined();
    expect(ship5.removeDeepWaldos).toBeDefined();
    // expect(ship5.fleetHasDuplicates()).toBeDefined();
  });

});

describe('test duplicateFleets', () => {
  test('test get all fleetIds', () => {
    expect(ship1.getIDsOfFleet()).toStrictEqual([0]);
    expect(ship2.getIDsOfFleet()).toStrictEqual([1]);
    expect(ship4.getIDsOfFleet()).toStrictEqual([3, 0, 1]);
    expect(ship5.getIDsOfFleet()).toStrictEqual([4, 1, 3, 0, 1, 2]);
  });

  test('fleetHasDuplicates', () => {
    expect(ship1.fleetHasDuplicates()).toBeFalsy();
    expect(ship2.fleetHasDuplicates()).toBeFalsy();
    expect(ship3.fleetHasDuplicates()).toBeFalsy();
    expect(ship4.fleetHasDuplicates()).toBeFalsy();
    expect(ship5.fleetHasDuplicates()).toBeTruthy();

  });
});

describe('venusian tests', () => {

  test('unique ID check', () => {
    expect(maude.getVsn()).toBe(0);
    expect(harold.getVsn()).toBe(1);
    expect(Waldo1.getVsn()).toBe(2);
    expect(Waldo2.getVsn()).toBe(3);
  });

  test('getName() check', () => {
    expect(maude.getName()).toBe('Maude');
    expect(harold.getName()).toBe('Harold');
    expect(Waldo1.getName()).toBe('Waldo');
  });
});

describe('ship tests', () => {

  test('test getter methods', () => {
    expect(ship1.getCrew()).toEqual([]);
    expect(ship3.getCrew()).toEqual([maude, harold]);

    expect(ship1.getCrew()).toEqual([]);
    expect(ship4.getCrew()).toEqual([harold, Waldo1]);

    expect(ship1.getSerialNumber()).toEqual(0);
    expect(ship2.getSerialNumber()).toEqual(1);
    expect(ship3.getSerialNumber()).toEqual(2);
    expect(ship4.getSerialNumber()).toEqual(3);

  });
  test('test waldo check', () => {
    expect(ship1.hasWaldo()).toBe(false);
    expect(ship2.hasWaldo()).toBe(true);
    expect(ship3.hasWaldo()).toBe(false);
    expect(ship4.hasWaldo()).toBe(true);
    expect(ship5.hasWaldo()).toBe(false);
  });

  test('waldos on crew', () => {
    expect(ship1.countWaldosOnCrew()).toBe(0);
    expect(ship2.countWaldosOnCrew()).toBe(2);
    expect(ship3.countWaldosOnCrew()).toBe(0);
    expect(ship4.countWaldosOnCrew()).toBe(1);
  });

  test('test totalWaldos', () => {
    expect(ship1.totalWaldos()).toBe(0);
    expect(ship2.totalWaldos()).toBe(2);
    expect(ship3.totalWaldos()).toBe(0);
    expect(ship4.totalWaldos()).toBe(3);
    expect(ship5.totalWaldos()).toBe(5);
  });

});

describe('remove Waldo test', () => {

  const ship6 = new Ship([], []);
  const ship7 = new Ship([maude, harold, Waldo1, Waldo2], []);

  test('removeWaldo test', () => {
    expect(ship6.hasWaldo()).toBe(false);
    ship6.removeWaldos();
    expect(ship6.hasWaldo()).toBe(false);

    expect(ship7.hasWaldo()).toBe(true);
    ship7.removeWaldos();
    expect(ship7.hasWaldo()).toBe(false);
  });

  test('removeDeepWaldo test', () => {
    expect(ship1.totalWaldos()).toBe(0);
    expect(ship2.totalWaldos()).toBe(2);
    expect(ship3.totalWaldos()).toBe(0);
    expect(ship4.totalWaldos()).toBe(3);
    expect(ship5.totalWaldos()).toBe(5);

    ship5.removeDeepWaldos();

    expect(ship1.totalWaldos()).toBe(0);
    expect(ship2.totalWaldos()).toBe(0);
    expect(ship3.totalWaldos()).toBe(0);
    expect(ship4.totalWaldos()).toBe(0);
    expect(ship5.totalWaldos()).toBe(0);

  });
});

