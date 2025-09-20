import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from './api.service';
import { DurationToSecondsPipe } from './duration-seconds.pipe';

@Component({
  selector: 'app-tracking-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, DurationToSecondsPipe],
  template: `
    <a routerLink="/tracking">← Back to Tracking</a>
    <h2>Tracking: {{ packageId }}</h2>
    <div *ngIf="!entries.length">No entries.</div>
    <h3>Per-visit combined snapshots</h3>
    <div *ngFor="let v of combined" style="margin:.5rem 0; padding:.5rem; border:1px solid #eee;">
      <div><strong>Visit:</strong> {{ v.visitId }}</div>
      <div><strong>Visit #:</strong> {{ visitIndex[v.visitId] || '-' }}</div>
      <div><strong>Version:</strong> {{ v.version }}</div>
      <div><strong>Started:</strong> {{ v.startedAt ? (v.startedAt | date:'medium') : '-' }}</div>
      <div><strong>First:</strong> {{ v.firstTimestamp | date:'medium' }} | <strong>Last:</strong> {{ v.lastTimestamp | date:'medium' }}</div>
      <div *ngIf="v.data?.['cmi.session_time'] || v.data?.['cmi.core.session_time']">
        <strong>Session (s):</strong>
        {{ (v.data['cmi.session_time'] || v.data['cmi.core.session_time']) | durationToSeconds }} seconds
      </div>
      <pre style="white-space: pre-wrap">{{ v.data | json }}</pre>
    </div>
  `
})
export class TrackingDetailComponent implements OnInit {
  packageId = '';
  entries: any[] = [];
  combined: any[] = [];
  visitIndex: Record<string, number> = {};
  constructor(private route: ActivatedRoute, private api: ApiService) {}
  ngOnInit(): void {
    this.packageId = this.route.snapshot.paramMap.get('id') || '';
    this.api.getTracking(this.packageId).subscribe((res: any) => this.entries = res || []);
    this.api.getCombined(this.packageId).subscribe((res: any) => this.combined = res || []);
    this.api.getVisitCount(this.packageId).subscribe((res: any) => {
      const visits = Array.isArray(res?.visits) ? res.visits : [];
      visits.sort((a: any, b: any) => (a.startedAt || 0) - (b.startedAt || 0));
      this.visitIndex = visits.reduce((acc: Record<string, number>, v: any, i: number) => {
        acc[v.id] = i + 1;
        return acc;
      }, {});
    });
  }
}


