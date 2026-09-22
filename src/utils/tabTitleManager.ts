import { Platform } from "react-native";

export class TabTitleManager {
  private baseTitle: string = "Alatext";
  private unreadCount: number = 0;
  private isWindowFocused: boolean = true;
  private flashInterval: any = null;

  constructor() {
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined") {
      try {
        this.isWindowFocused = typeof document.hasFocus === "function" ? document.hasFocus() : true;
        if (document.title) {
          this.baseTitle = document.title;
        }

        window.addEventListener("focus", () => this.handleFocus());
        window.addEventListener("blur", () => this.handleBlur());
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) {
            this.handleFocus();
          } else {
            this.handleBlur();
          }
        });
      } catch (e) {
        console.warn("TabTitleManager constructor error:", e);
      }
    }
  }

  public setBaseTitle(title: string) {
    this.baseTitle = title || "Alatext";
    this.render();
  }

  public getBaseTitle(): string {
    return this.baseTitle;
  }

  public incrementUnread(senderName?: string) {
    this.unreadCount += 1;
    this.render(senderName);
  }

  public setUnreadCount(count: number) {
    this.unreadCount = Math.max(0, count);
    this.render();
  }

  public clearUnread() {
    this.unreadCount = 0;
    this.stopFlash();
    this.render();
  }

  public getUnreadCount(): number {
    return this.unreadCount;
  }

  public isFocused(): boolean {
    if (Platform.OS !== "web" || typeof document === "undefined") return true;
    return document.hasFocus() && !document.hidden;
  }

  private handleFocus() {
    this.isWindowFocused = true;
    this.clearUnread();
  }

  private handleBlur() {
    this.isWindowFocused = false;
  }

  private render(senderName?: string) {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    if (this.unreadCount > 0) {
      const badge = `(${this.unreadCount})`;
      if (senderName) {
        document.title = `${badge} ${senderName} • ${this.baseTitle}`;
      } else {
        document.title = `${badge} ${this.baseTitle}`;
      }
    } else {
      document.title = this.baseTitle;
    }
  }

  private stopFlash() {
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
  }
}

export const tabTitleManager = new TabTitleManager();
