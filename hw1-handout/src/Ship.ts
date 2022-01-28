import Venusian from './Venusian';

export default class Ship {
  static currentId = 0;
    
  serialNumber: number;

  crew: Venusian[];

  daughters: Ship[];
    
  constructor(crew: Venusian[], daughters: Ship[]) {
    this.crew = crew;
    this.daughters = daughters;
    this.serialNumber = Ship.currentId;
    Ship.currentId += 1;
  }

  /**
   * @returns Venusian[] - list of crew members
   */

  getCrew():Venusian[] {
    return this.crew;
  }

  /**
   * @returns Ship[] - List of direct daughters.
   */
  getDaughters():Ship[] {
    return this.daughters;
  }

  /**
   * @returns number - the sips series number
   */
  getSerialNumber():number {
    return this.serialNumber;
  }

  /**
   * Determines if there is a "Waldo" anywhere in the crew
   * @returns boolean
   */
  hasWaldo():boolean {
    let waldoPresent = false;

    this.crew.forEach(member => {
      
      if (member.getName() === 'Waldo') {
        waldoPresent = true;
      }
    });
    return waldoPresent;
  }

  /**
   * Helper class for totalWaldos() method.
   * @returns number : count of total waldo's on this ship.
   */
  countWaldosOnCrew():number {
    let crewWaldoCount = 0;

    this.crew.forEach(member => {
      if (member.getName() === 'Waldo') {
        crewWaldoCount += 1;
      }
    });

    return crewWaldoCount;

  }

  /**
   * 
   * @returns number:  total waldos on whole fleet
   */
  totalWaldos():number {
    let daughterWaldoCount = 0;

    this.daughters.forEach(d => {
      daughterWaldoCount += d.totalWaldos();
    });

    return daughterWaldoCount + this.countWaldosOnCrew();
  }

  /**
   * removes all waldos from the crew on just this ship
   * @returns Nothing
   */
  removeWaldos():void {

    function isWaldo(element: Venusian) {
      return element.getName() !== 'Waldo';
    }
    this.crew = this.crew.filter(isWaldo);
  }

  /**
   * Removes all waldos from the ship and its daughters.
   * @returns Nothing
   */
  removeDeepWaldos():void {

    this.removeWaldos();

    this.daughters.forEach(d => {
      d.removeDeepWaldos();
    });
  }

  /**
   * Gathers list of all fleet IDs (this ship and its daughters)
   * @returns array of numbers (all fleet IDs)
   */
  getIDsOfFleet():number[] {
    // grab all IDs from daughters and daughters of daughters
    let IDs: Array<number> = [this.serialNumber];

    this.daughters.forEach(d => {
      IDs = IDs.concat(d.getIDsOfFleet());
    });

    return IDs;
  }

  /**
   * Determines if there is a duplicate in the ships fleet and its daughters
   * This is determined based of serial IDs
   * @returns boolean
   */
  fleetHasDuplicates():boolean {
    const fleetIDs = this.getIDsOfFleet();

    const sortedIDs = fleetIDs.sort();

    for (let i = 0; i < sortedIDs.length; i += 1) {
      if (sortedIDs[i] === sortedIDs[i + 1]) {
        return true;
      }
    }
  
    return false;
  }

}