import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService, UploadedPackage } from './api.service';

@Component({
  selector: 'app-packages-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <h2>Packages</h2>
    <a routerLink="/upload">Upload new</a>
    <ul>
      <li *ngFor="let p of packages">
        <a [routerLink]="['/packages', p.id]">{{ p.id }}</a>
      </li>
    </ul>
  `
})
export class PackagesListComponent implements OnInit {
  packages: UploadedPackage[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.listPackages().subscribe((pkgs) => (this.packages = pkgs));
  }
}


