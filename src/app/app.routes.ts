import { Routes } from '@angular/router';
import { PackagesListComponent } from './scorm/packages-list.component';
import { UploadComponent } from './scorm/upload.component';
import { PlayerComponent } from './scorm/player.component';
import { TrackingListComponent } from './scorm/tracking-list.component';
import { TrackingDetailComponent } from './scorm/tracking-detail.component';

export const routes: Routes = [
  { path: '', component: PackagesListComponent },
  { path: 'upload', component: UploadComponent },
  { path: 'packages/:id', component: PlayerComponent },
  { path: 'tracking', component: TrackingListComponent },
  { path: 'tracking/:id', component: TrackingDetailComponent },
  { path: '**', redirectTo: '' }
];
