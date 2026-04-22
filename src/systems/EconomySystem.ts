import { EconomyState, SavedEconomyData } from '../types';

export class EconomySystem {
  private state: EconomyState;
  private listeners: Set<(state: EconomyState) => void> = new Set();

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): EconomyState {
    return {
      money: 3500,
      ticketPrice: 5,
      totalVisitors: 0,
      activeVisitors: 0,
      parkRating: 10,
      averageHappiness: 50,
      dailyIncome: 0,
      dailyExpenses: 0,
      maintenancePerMinute: 0,
      netProfit: 0,
      isOpen: true
    };
  }

  /**
   * Returns a shallow copy of the state — safe for subscribers/UI that may hold references.
   * Not for hot paths: use the direct getters below when you only need specific fields.
   */
  public getState(): EconomyState {
    return { ...this.state };
  }

  // Direct property accessors — zero allocation, for use in the per-frame update loop.
  public get isOpen(): boolean    { return this.state.isOpen; }
  public get ticketPrice(): number { return this.state.ticketPrice; }
  public get parkRating(): number  { return this.state.parkRating; }

  public exportSaveData(): SavedEconomyData {
    return {
      money: this.state.money,
      ticketPrice: this.state.ticketPrice,
      totalVisitors: this.state.totalVisitors,
      activeVisitors: this.state.activeVisitors,
      dailyIncome: this.state.dailyIncome,
      dailyExpenses: this.state.dailyExpenses,
      netProfit: this.state.netProfit,
      isOpen: this.state.isOpen
    };
  }

  public restoreSaveData(data: SavedEconomyData): void {
    this.state = {
      ...this.createInitialState(),
      money: Math.round(data.money),
      ticketPrice: Math.round(data.ticketPrice),
      totalVisitors: Math.max(0, Math.round(data.totalVisitors)),
      activeVisitors: 0,
      dailyIncome: Math.max(0, Math.round(data.dailyIncome)),
      dailyExpenses: Math.max(0, Math.round(data.dailyExpenses)),
      netProfit: Math.round(data.netProfit),
      isOpen: data.isOpen
    };
    this.notifyListeners();
  }

  public reset(): void {
    this.state = this.createInitialState();
    this.notifyListeners();
  }

  public addMoney(amount: number): void {
    const intAmount = Math.round(amount);
    this.state.money += intAmount;
    this.state.dailyIncome += intAmount;
    this.state.netProfit = this.state.dailyIncome - this.state.dailyExpenses;
  }

  /** One-time purchase — deducts money but does NOT count as recurring expense. */
  public spendMoney(amount: number): boolean {
    const intAmount = Math.round(amount);
    if (this.state.money >= intAmount) {
      this.state.money -= intAmount;
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /** Recurring maintenance — deducts money AND adds to dailyExpenses. */
  public chargeMaintenance(amount: number): void {
    const intAmount = Math.round(amount);
    this.state.money -= intAmount;
    this.state.dailyExpenses += intAmount;
    this.state.netProfit = this.state.dailyIncome - this.state.dailyExpenses;
    this.notifyListeners();
  }

  public setMaintenancePerMinute(amount: number): void {
    this.state.maintenancePerMinute = Math.max(0, Math.round(amount));
  }

  public canAfford(amount: number): boolean {
    return this.state.money >= amount;
  }

  public addVisitor(): void {
    this.state.totalVisitors += 1;
    this.state.activeVisitors += 1;
    this.addMoney(this.state.ticketPrice);
  }

  public addRestoredVisitor(): void {
    this.state.activeVisitors += 1;
    this.notifyListeners();
  }

  public removeVisitor(): void {
    this.state.activeVisitors = Math.max(0, this.state.activeVisitors - 1);
  }

  public updateParkRating(
    averageHappiness: number,
    facilityScore: number,
    decorationAppeal: number,
    activeVisitors = 0,
    rideCount = 0,
    shopCount = 0,
    serviceCount = 0
  ): void {
    const happinessComponent  = averageHappiness * 0.55;
    const facilityComponent   = Math.min(facilityScore * 1.0, 28);
    const decorationComponent = Math.min(decorationAppeal, 18);

    // Visitor gate: rating is capped without enough people to validate it
    const visitorCap = activeVisitors === 0 ? 19
                     : activeVisitors < 5   ? 29
                     : activeVisitors < 10  ? 44
                     : activeVisitors < 15  ? 64
                     : 92;

    // Diversity gate: a park with only one type of facility can't reach high stars
    // 1 type (rides only)   → max 49  (2 stars)
    // 2 types (+ shop)      → max 69  (3 stars)
    // 3 types (+ service)   → max 92  (4–5 stars)
    const diversityTypes = (rideCount > 0 ? 1 : 0) + (shopCount > 0 ? 1 : 0) + (serviceCount > 0 ? 1 : 0);
    const diversityCap = diversityTypes <= 1 ? 49
                       : diversityTypes === 2 ? 69
                       : 92;

    const smoothed = this.state.averageHappiness * 0.7 + averageHappiness * 0.3;
    this.state.averageHappiness = Math.round(smoothed);
    this.state.parkRating = Math.max(10, Math.min(visitorCap, diversityCap, Math.round(happinessComponent + facilityComponent + decorationComponent)));
  }

  public notify(): void {
    this.notifyListeners();
  }

  public setTicketPrice(price: number): void {
    this.state.ticketPrice = Math.round(Math.max(0, Math.min(price, 50)));
    this.notifyListeners();
  }

  public setParkOpen(isOpen: boolean): void {
    this.state.isOpen = isOpen;
    this.notifyListeners();
  }

  public subscribe(callback: (state: EconomyState) => void): () => void {
    this.listeners.add(callback);
    callback(this.getState());

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }
}
