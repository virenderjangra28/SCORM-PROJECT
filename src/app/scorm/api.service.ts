import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type UploadedPackage = { id: string; path: string; manifest?: string };

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  uploadScorm(file: File): Observable<UploadedPackage> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadedPackage>('/api/upload', formData);
  }

  listPackages(): Observable<UploadedPackage[]> {
    return this.http.get<UploadedPackage[]>('/api/packages');
  }

  getPackage(id: string): Observable<UploadedPackage> {
    return this.http.get<UploadedPackage>(`/api/packages/${id}`);
  }

  saveTracking(packageId: string, version: '1.2' | '2004', snapshot: Record<string, string>, visitId?: string) {
    return this.http.post(`/api/track/${packageId}`, { version, data: snapshot, visitId });
  }

  getTracking(packageId: string) {
    return this.http.get<Record<string, any>>(`/api/track/${packageId}`);
  }

  getTrackingAll() {
    return this.http.get<Record<string, any>>('/api/track');
  }

  recordVisit(packageId: string) {
    return this.http.post<{ packageId: string; count: number }>(`/api/visit/${packageId}`, {});
  }

  getVisitCount(packageId: string) {
    return this.http.get<{ packageId: string; count: number }>(`/api/visit/${packageId}`);
  }

  getCombined(packageId: string) {
    return this.http.get<any[]>(`/api/track/${packageId}/combined`);
  }

  getCombinedAll() {
    return this.http.get<Record<string, any[]>>('/api/track/combined');
  }
}


