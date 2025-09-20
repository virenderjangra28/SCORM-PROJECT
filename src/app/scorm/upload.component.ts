import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, UploadedPackage } from './api.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <h2>Upload SCORM Package (ZIP)</h2>
    <input type="file" (change)="onFileChange($event)" accept=".zip" />
    <button (click)="upload()" [disabled]="!file || uploading">{{ uploading ? 'Uploading...' : 'Upload' }}</button>
    <div *ngIf="error" style="color:red">{{ error }}</div>
    <div *ngIf="pkg">
      <p>Uploaded: {{ pkg.id }}</p>
      <a [routerLink]="['/packages', pkg.id]">Open package</a>
    </div>
  `
})
export class UploadComponent {
  file: File | null = null;
  uploading = false;
  error = '';
  pkg: UploadedPackage | null = null;

  constructor(private api: ApiService) {}

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = (input.files && input.files[0]) || null;
  }

  upload(): void {
    if (!this.file) return;
    this.uploading = true;
    this.error = '';
    this.api.uploadScorm(this.file).subscribe({
      next: (res) => {
        this.pkg = res;
        this.uploading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Upload failed';
        this.uploading = false;
      }
    });
  }
}


