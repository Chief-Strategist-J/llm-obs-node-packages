/**
 * @file loop-detector.ts
 * @description Infinite Event Cascade Loop Detector for EventBus.
 */

import { EVENT_BUS_CONSTANTS } from "../constants/constants";

export class CascadeLoopDetector {
  private readonly maxDepth: number;

  constructor(maxDepth = EVENT_BUS_CONSTANTS.DEFAULT_MAX_CASCADE_DEPTH) {
    this.maxDepth = maxDepth;
  }

  public checkCascadeDepth(currentDepth: number, eventName: string): void {
    if (currentDepth > this.maxDepth) {
      const msg = `[EventBus:CascadeLoop] Maximum cascade depth ${this.maxDepth} exceeded on event '${eventName}'. Infinite event loop detected!`;
      const err: any = new Error(msg);
      err.code = EVENT_BUS_CONSTANTS.ERR_CASCADE_LOOP_DETECTED;
      throw err;
    }
  }
}
