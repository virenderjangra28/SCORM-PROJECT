import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ScormService } from './scorm.service';
import { installScormRuntime } from './runtime';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from './api.service';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="display:flex; gap: 1rem; align-items:center;">
      <a routerLink="/">← Back</a>
      <div>Package: {{ packageId }}</div>
      <div>SCORM Version: {{ scormService.getVersion() }}</div>
      <div *ngIf="visitCount !== null">Visits: {{ visitCount }}</div>
      <button (click)="markComplete()">Mark Complete</button>
    </div>
    <div *ngIf="lastSnapshot" style="margin: .5rem 0; padding:.5rem; border:1px solid #ddd;">
      <strong>Last saved snapshot:</strong>
      <pre style="white-space: pre-wrap">{{ lastSnapshot | json }}</pre>
    </div>
    <iframe
      *ngIf="launchUrl"
      [src]="launchUrl"
      width="100%"
      height="600"
      referrerpolicy="no-referrer"
    ></iframe>
    <div *ngIf="!launchUrl">imsmanifest.xml not parsed or launch file not found.</div>
  `
})
export class PlayerComponent implements OnInit, OnDestroy {
  packageId = '';
  launchUrl: SafeResourceUrl | '' = '';
  lastSnapshot: any = null;
  visitCount: number | null = null;
  currentVisitId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private api: ApiService,
    private sanitizer: DomSanitizer,
    public scormService: ScormService,
  ) {}

  ngOnInit(): void {
    this.packageId = this.route.snapshot.paramMap.get('id') || '';
    this.api.getPackage(this.packageId).subscribe({
      next: (pkg) => {
        const base = pkg.path || `/packages/${this.packageId}`;
        // Install shim with commit persistence
        installScormRuntime(`scorm:${this.packageId}` as string, undefined, (version, snapshot) => {
          this.lastSnapshot = { version, data: snapshot, visitId: this.currentVisitId };
          this.api.saveTracking(this.packageId, version, snapshot, this.currentVisitId || undefined).subscribe();
        });
        this.api.recordVisit(this.packageId).subscribe((res) => { this.visitCount = res.count; this.currentVisitId = (res as any).visitId || null; });
        this.resolveLaunchUrl(base);
      },
      error: () => {
        const base = `/packages/${this.packageId}`;
        installScormRuntime(`scorm:${this.packageId}` as string, undefined, (version, snapshot) => {
          this.lastSnapshot = { version, data: snapshot, visitId: this.currentVisitId };
          this.api.saveTracking(this.packageId, version, snapshot, this.currentVisitId || undefined).subscribe();
        });
        this.api.recordVisit(this.packageId).subscribe((res) => { this.visitCount = res.count; this.currentVisitId = (res as any).visitId || null; });
        this.resolveLaunchUrl(base);
      }
    });
    // Don't pre-initialize here; content calls Initialize/LMSInitialize
  }

  private resolveLaunchUrl(base: string): void {
    const manifestUrl = `${base}/imsmanifest.xml`;
    this.http.get(manifestUrl, { responseType: 'text' }).subscribe({
      next: (xml) => {
        try {
          const doc = new DOMParser().parseFromString(xml, 'application/xml');
          const href = this.findLaunchHref(doc);
          if (href) {
            const full = new URL(href, window.location.origin + `${base}/imsmanifest.xml`).toString();
            this.launchUrl = this.sanitizer.bypassSecurityTrustResourceUrl(full);
            return;
          }
        } catch {}
        this.setFallback(base);
      },
      error: () => this.setFallback(base)
    });
  }

  private setFallback(base: string): void {
    const candidates = ['shared/launchpage.html', 'index.html', 'launch.html', 'story.html', 'scormdriver/indexAPI.html'];
    const full = `${base}/${candidates[0]}`;
    this.launchUrl = this.sanitizer.bypassSecurityTrustResourceUrl(full);
  }

  private findLaunchHref(doc: Document): string | null {
    // Helper to read elements by tag name ignoring namespaces
    const byTag = (name: string): Element[] => Array.from(doc.getElementsByTagName(name));
    const organizations = byTag('organizations')[0];
    const defaultOrgId = organizations?.getAttribute('default') || '';
    const organizationsList = byTag('organization');

    // Build map of resources
    const resourcesEls = byTag('resource');
    const idToHref = new Map<string, string>();
    const idToType = new Map<string, string>();
    for (const r of resourcesEls) {
      const id = r.getAttribute('identifier') || '';
      const href = r.getAttribute('href') || '';
      const scormType = r.getAttribute('adlcp:scormType') || r.getAttribute('adlcp:scormtype') || r.getAttribute('scormType') || r.getAttribute('scormtype') || '';
      if (id && href) idToHref.set(id, href);
      if (id && scormType) idToType.set(id, scormType);
    }

    // Try default org -> first item with identifierref
    let launchRef = '';
    if (defaultOrgId) {
      const defOrg = organizationsList.find(o => o.getAttribute('identifier') === defaultOrgId);
      if (defOrg) {
        const items = Array.from(defOrg.getElementsByTagName('item')) as Element[];
        const withRef = items.find(i => i.getAttribute('identifierref'));
        if (withRef) launchRef = withRef.getAttribute('identifierref') || '';
      }
    }
    // Fallback to any organization first item with identifierref
    if (!launchRef) {
      for (const org of organizationsList) {
        const items = Array.from(org.getElementsByTagName('item')) as Element[];
        const withRef = items.find(i => i.getAttribute('identifierref'));
        if (withRef) { launchRef = withRef.getAttribute('identifierref') || ''; break; }
      }
    }
    if (launchRef && idToHref.has(launchRef)) return idToHref.get(launchRef)!;

    // Next: first SCO resource
    for (const [id, href] of idToHref) {
      const t = (idToType.get(id) || '').toLowerCase();
      if (t === 'sco') return href;
    }
    // Next: any resource with href
    if (resourcesEls.length) {
      const anyHref = resourcesEls.find(r => r.getAttribute('href'))?.getAttribute('href');
      if (anyHref) return anyHref;
    }
    // Next: look for file hrefs ending in .html/.htm
    const fileEls = byTag('file');
    const fileHref = fileEls.map(f => f.getAttribute('href') || '')
      .find(h => /\.html?$/.test(h));
    if (fileHref) return fileHref;
    return null;
  }

  markComplete(): void {
    // best effort for both versions
    const v = this.scormService.getVersion();
    if (v === '2004') {
      this.scormService.setValue('cmi.completion_status', 'completed');
      this.scormService.setValue('cmi.success_status', 'passed');
    } else if (v === '1.2') {
      this.scormService.setValue('cmi.core.lesson_status', 'completed');
      this.scormService.setValue('cmi.core.score.raw', '100');
    }
    this.scormService.commit();
  }

  ngOnDestroy(): void {
    this.scormService.commit();
    this.scormService.terminate();
  }
}


