import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'durationToSeconds', standalone: true })
export class DurationToSecondsPipe implements PipeTransform {
  transform(value: string | null | undefined): number | '' {
    if (value == null) return '';
    const input = String(value).trim();
    if (!input) return '';

    // SCORM 2004 ISO-8601 duration (time-only or with days): e.g., PT12.28S, PT1H2M3.45S, P1DT2H
    const iso = input.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
    if (iso) {
      const days = Number(iso[1] || 0);
      const hours = Number(iso[2] || 0);
      const mins = Number(iso[3] || 0);
      const secs = Number(iso[4] || 0);
      const total = days * 86400 + hours * 3600 + mins * 60 + secs;
      return Math.round(total * 100) / 100;
    }

    // SCORM 1.2 time format HH:MM:SS or HH:MM:SS.ss
    const s12 = input.match(/^(\d{2,}):([0-5]?\d):([0-5]?\d(?:\.\d+)?)$/);
    if (s12) {
      const hours = Number(s12[1]);
      const mins = Number(s12[2]);
      const secs = Number(s12[3]);
      const total = hours * 3600 + mins * 60 + secs;
      return Math.round(total * 100) / 100;
    }

    return '';
  }
}


