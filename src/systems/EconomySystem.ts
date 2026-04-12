import { EconomyState } from '../types';

export class EconomySystem {
  private state: EconomyState;
  private listeners: Set<(state: EconomyState) => void> = new Set();

  constructor() {
    this.state = {
      money: 5000,
      ticketPrice: 10,
      totalVisitors: 0,
      activeVisitors: 0,
      parkRating: 10,
      averageHappiness: 10,
      dailyIncome: 0,
      dailyExpenses: 0,
      netProfit: 0,
      isOpen: true
    };
  }

  public getState(): EconomyState {
    return { ...this.state };
  }

  public addMoney(amount: number): void {
    this.state.money += amount;
    this.state.dailyIncome += amount;
    this.state.netProfit = this.state.dailyIncome - this.state.dailyExpenses;
    this.notifyListeners();
  }

  /** One-time purchase — deducts money but does NOT count as recurring expense. */
  public spendMoney(amount: number): boolean {
    if (this.state.money >= amount) {
      this.state.money -= amount;
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /** Recurring maintenance — deducts money AND adds to dailyExpenses. */
  public chargeMaintenance(amount: number): void {
    this.state.money -= amount;
    this.state.dailyExpenses += amount;
    this.state.netProfit = this.state.dailyIncome - this.state.dailyExpenses;
    this.notifyListeners();
  }

  public canAfford(amount: number): boolean {
    return this.state.money >= amount;
  }

  public addVisitor(): void {
    this.state.totalVisitors += 1;
    this.state.activeVisitors += 1;
    this.addMoney(this.state.ticketPrice);
    this.notifyListeners();
  }

  public removeVisitor(): void {
    this.state.activeVisitors = Math.max(0, this.state.activeVisitors - 1);
    this.notifyListeners();
  }

  public updateParkRating(averageHappiness: number, facilityScore: number, decorationAppeal: number): void {
    const happinessComponent = averageHappiness * 0.6;
    const facilityComponent = Math.min(facilityScore * 2.5, 30);
    const decorationComponent = Math.min(decorationAppeal, 10);

    this.state.averageHappiness = Math.round(averageHappiness);
    this.state.parkRating = Math.round(happinessComponent + facilityComponent + decorationComponent);
    this.notifyListeners();
  }

  public setTicketPrice(price: number): void {
    this.state.ticketPrice = Math.max(0, Math.min(price, 50));
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
