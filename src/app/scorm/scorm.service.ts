import { Injectable } from '@angular/core';

type Scorm12API = {
  LMSInitialize: (param: string) => string;
  LMSFinish: (param: string) => string;
  LMSGetValue: (element: string) => string;
  LMSSetValue: (element: string, value: string) => string;
  LMSCommit: (param: string) => string;
  LMSGetLastError: () => string;
  LMSGetErrorString: (code: string) => string;
  LMSGetDiagnostic: (code: string) => string;
};

type Scorm2004API = {
  Initialize: (param: string) => string;
  Terminate: (param: string) => string;
  GetValue: (element: string) => string;
  SetValue: (element: string, value: string) => string;
  Commit: (param: string) => string;
  GetLastError: () => string;
  GetErrorString: (code: string) => string;
  GetDiagnostic: (code: string) => string;
};

export type ScormVersion = '1.2' | '2004' | 'none';

@Injectable({ providedIn: 'root' })
export class ScormService {
  private api12: Scorm12API | null = null;
  private api2004: Scorm2004API | null = null;
  private initialized = false;
  private version: ScormVersion = 'none';

  private getWindowChain(start: Window | null): Window[] {
    const chain: Window[] = [];
    let w: any = start;
    const visited = new Set<Window>();
    while (w && !visited.has(w)) {
      chain.push(w);
      visited.add(w);
      if (w === w.parent) break;
      w = w.parent;
    }
    // Add opener if present
    let opener = (start as any)?.opener as Window | null | undefined;
    if (opener) chain.push(opener);
    return chain;
  }

  private findAPI(): void {
    if (typeof window === 'undefined') return;
    const win = window as any;
    const chain = this.getWindowChain(win);

    for (const ctx of chain) {
      const anyCtx = ctx as any;
      if (anyCtx.API_1484_11) {
        this.api2004 = anyCtx.API_1484_11 as Scorm2004API;
        this.version = '2004';
        return;
      }
      if (anyCtx.API) {
        this.api12 = anyCtx.API as Scorm12API;
        this.version = '1.2';
        return;
      }
    }

    this.version = 'none';
  }

  getVersion(): ScormVersion {
    if (this.version === 'none') this.findAPI();
    return this.version;
  }

  initialize(): boolean {
    if (this.initialized) return true;
    this.findAPI();
    try {
      if (this.api2004) {
        const res = this.api2004.Initialize('');
        this.initialized = res === 'true';
        return this.initialized;
      }
      if (this.api12) {
        const res = this.api12.LMSInitialize('');
        this.initialized = res === 'true';
        return this.initialized;
      }
    } catch (e) {
      console.warn('SCORM initialize error', e);
    }
    return false;
  }

  terminate(): boolean {
    if (!this.initialized) return true;
    try {
      if (this.api2004) {
        const res = this.api2004.Terminate('');
        this.initialized = !(res === 'true');
        return res === 'true';
      }
      if (this.api12) {
        const res = this.api12.LMSFinish('');
        this.initialized = !(res === 'true');
        return res === 'true';
      }
    } catch (e) {
      console.warn('SCORM terminate error', e);
    }
    return false;
  }

  getValue(element: string): string | null {
    try {
      if (!this.initialized) this.initialize();
      if (this.api2004) return this.api2004.GetValue(element);
      if (this.api12) return this.api12.LMSGetValue(element);
    } catch (e) {
      console.warn('SCORM getValue error', e);
    }
    return null;
  }

  setValue(element: string, value: string): boolean {
    try {
      if (!this.initialized) this.initialize();
      if (this.api2004) return this.api2004.SetValue(element, value) === 'true';
      if (this.api12) return this.api12.LMSSetValue(element, value) === 'true';
    } catch (e) {
      console.warn('SCORM setValue error', e);
    }
    return false;
  }

  commit(): boolean {
    try {
      if (!this.initialized) this.initialize();
      if (this.api2004) return this.api2004.Commit('') === 'true';
      if (this.api12) return this.api12.LMSCommit('') === 'true';
    } catch (e) {
      console.warn('SCORM commit error', e);
    }
    return false;
  }
}
