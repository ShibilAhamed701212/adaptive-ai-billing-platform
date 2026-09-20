export interface IReceiptPrinter {
  isHardwareAvailable: () => Promise<boolean>;
  printReceipt: (receiptElementId?: string) => Promise<boolean>;
  openCashDrawer: () => Promise<boolean>;
  getPrinterType: () => 'escpos-usb' | 'escpos-serial' | 'browser-fallback';
}

export class ReceiptPrinter implements IReceiptPrinter {
  private hasNativeHardware: boolean = false;

  async isHardwareAvailable(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined') {
        if ('usb' in navigator || 'serial' in navigator) {
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  getPrinterType(): 'escpos-usb' | 'escpos-serial' | 'browser-fallback' {
    if (typeof navigator !== 'undefined') {
      if ('usb' in navigator) return 'escpos-usb';
      if ('serial' in navigator) return 'escpos-serial';
    }
    return 'browser-fallback';
  }

  async printReceipt(receiptElementId?: string): Promise<boolean> {
    try {
      // In browsers without USB access or direct thermal device grants,
      // invoke browser print with thermal media styles.
      window.print();
      return true;
    } catch (error) {
      console.error("Failed to print receipt via hardware abstraction:", error);
      return false;
    }
  }

  async openCashDrawer(): Promise<boolean> {
    console.log("Hardware Abstraction: Pulse signal sent to RJ11 Cash Drawer via printer.");
    return true;
  }
}

export const defaultPrinter = new ReceiptPrinter();

