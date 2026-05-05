// Notification store singleton for real-time alerts across the app
export const notificationStore = {
  listeners: [] as ((n: any[]) => void)[],
  notifications: [] as any[],
  add(n: any) {
    this.notifications = [n, ...this.notifications].slice(0, 50);
    this.listeners.forEach(l => l(this.notifications));
  },
  subscribe(l: (n: any[]) => void) {
    this.listeners.push(l);
    return () => { this.listeners = this.listeners.filter(x => x !== l); };
  }
};
