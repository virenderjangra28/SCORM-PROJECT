type RuntimeOptions = {
  storageKey: string;
  onCommit?: (version: '1.2' | '2004', snapshot: Record<string, string>) => void;
  version: '1.2' | '2004';
};

type StringMap = { [key: string]: string };

class ScormRuntimeCore {
  private initialized = false;
  private lastError = '0';
  private data: StringMap = {};
  private readonly storageKey: string;
  private readonly onCommit?: (version: '1.2' | '2004', snapshot: Record<string, string>) => void;
  private readonly version: '1.2' | '2004';
  private pendingNotify: any = null;

  constructor(options: RuntimeOptions) {
    this.storageKey = options.storageKey;
    this.onCommit = options.onCommit;
    this.version = options.version;
    this.data = this.load();
  }

  initialize(): string {
    this.initialized = true;
    this.lastError = '0';
    return 'true';
  }

  terminate(): string {
    // save and emit a final snapshot
    this.save();
    try {
      if (this.onCommit) this.onCommit(this.version, { ...this.data });
    } catch {}
    this.initialized = false;
    this.lastError = '0';
    return 'true';
  }

  getValue(element: string): string {
    if (!this.initialized) {
      this.lastError = '301'; // not initialized
      return '';
    }
    this.lastError = '0';
    return this.data[element] ?? '';
  }

  setValue(element: string, value: string): string {
    if (!this.initialized) {
      this.lastError = '301';
      return 'false';
    }
    this.data[element] = String(value);
    this.lastError = '0';
    // Debounced notify to persist even if SCO never calls Commit
    this.save();
    if (this.pendingNotify) clearTimeout(this.pendingNotify);
    this.pendingNotify = setTimeout(() => {
      try { if (this.onCommit) this.onCommit(this.version, { ...this.data }); } catch {}
      this.pendingNotify = null;
    }, 800);
    return 'true';
  }

  commit(): string {
    this.save();
    this.lastError = '0';
    try {
      if (this.onCommit) this.onCommit(this.version, { ...this.data });
    } catch {}
    return 'true';
  }

  getLastError(): string {
    return this.lastError;
  }

  getErrorString(code: string): string {
    const map: Record<string, string> = {
      '0': 'No error',
      '301': 'Not initialized'
    };
    return map[code] ?? 'Unknown error';
  }

  getDiagnostic(code: string): string {
    return `Diagnostic: ${code}`;
  }

  private load(): StringMap {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch {
      // ignore
    }
  }
}

function createScorm2004API(core: ScormRuntimeCore) {
  return {
    Initialize: (p: string) => core.initialize(),
    Terminate: (p: string) => core.terminate(),
    GetValue: (el: string) => core.getValue(el),
    SetValue: (el: string, v: string) => core.setValue(el, v),
    Commit: (p: string) => core.commit(),
    GetLastError: () => core.getLastError(),
    GetErrorString: (code: string) => core.getErrorString(code),
    GetDiagnostic: (code: string) => core.getDiagnostic(code)
  };
}

function createScorm12API(core: ScormRuntimeCore) {
  return {
    LMSInitialize: (p: string) => core.initialize(),
    LMSFinish: (p: string) => core.terminate(),
    LMSGetValue: (el: string) => core.getValue(el),
    LMSSetValue: (el: string, v: string) => core.setValue(el, v),
    LMSCommit: (p: string) => core.commit(),
    LMSGetLastError: () => core.getLastError(),
    LMSGetErrorString: (code: string) => core.getErrorString(code),
    LMSGetDiagnostic: (code: string) => core.getDiagnostic(code)
  };
}

export function installScormRuntime(
  storageKey: string,
  version?: '1.2' | '2004',
  onCommit?: (version: '1.2' | '2004', snapshot: Record<string, string>) => void,
): void {
  const w = window as any;
  if (!version || version === '2004') {
    const core2004 = new ScormRuntimeCore({ storageKey: `${storageKey}:2004`, version: '2004', onCommit });
    w.API_1484_11 = createScorm2004API(core2004);
  }
  if (!version || version === '1.2') {
    const core12 = new ScormRuntimeCore({ storageKey: `${storageKey}:12`, version: '1.2', onCommit });
    w.API = createScorm12API(core12);
  }
}


