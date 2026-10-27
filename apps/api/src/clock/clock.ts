import { Injectable } from '@nestjs/common';

/** The current time. Read it only through this provider, so tests can fix it (spec §3.6). */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
