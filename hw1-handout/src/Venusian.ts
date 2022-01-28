export default class Venusian {
  static currentId = 0;

  name: string;
  
  vsn: number;

  constructor(name: string) {
    this.name = name;
    this.vsn = Venusian.currentId;
    Venusian.currentId += 1;
  }

  /**
   * 
   * @returns name of Venusian
   */
  getName(): string {
    return this.name;
  }

  /**
   * 
   * @returns Venusian ID
   */
  getVsn(): number {
    return this.vsn;
  }
}