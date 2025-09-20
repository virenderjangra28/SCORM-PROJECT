import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from './api.service';

@Component({
  selector: 'app-tracking-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <h2>Tracking Records</h2>
    <a routerLink="/">Packages</a>
    <div *ngIf="!keys.length">No records yet.</div>
    <div *ngFor="let key of keys" style="margin: .5rem 0;">
      <h3><a [routerLink]="['/tracking', key]">{{ key }}</a></h3>
      <small>{{ (data[key] || []).length }} entries</small>
    </div>
  `
})
export class TrackingListComponent implements OnInit {
  data: Record<string, any[]> = {};
  keys: string[] = [];
  constructor(private api: ApiService) {}
  ngOnInit(): void {
    this.api.getTrackingAll().subscribe((res) => {
      this.data = res || {};
      this.keys = Object.keys(this.data);
    });
  }
}


