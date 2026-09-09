/**
 * @file pattern-matcher.ts
 * @description Wildcard Topic Pattern Matcher for EventBus Subscriptions.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Pattern Tokenization:
 *    - Converts wildcard topics like `user.*` or `order.#` into dynamic Regular Expressions.
 *    - `*` matches exactly one segment (`user.created` matches `user.*`, but `user.created.v1` does not).
 *    - `#` or `**` matches zero or more segments (`order.#` matches `order.item.added`).
 */

import { HTTP_CONSTANTS } from "../../http/constants";
import { EVENT_BUS_CONSTANTS } from "../constants/constants";

export function isWildcardPattern(pattern: string): boolean {
  return pattern.includes(HTTP_CONSTANTS.CHAR_ASTERISK) || pattern.includes(EVENT_BUS_CONSTANTS.CHAR_HASH);
}

export function compilePatternToRegex(pattern: string): RegExp {
  const parts = pattern.split(HTTP_CONSTANTS.CHAR_DOT);
  const regexParts = parts.map((part) => {
    if (part === HTTP_CONSTANTS.CHAR_ASTERISK) return "[^.]+";
    if (part === EVENT_BUS_CONSTANTS.CHAR_HASH || part === HTTP_CONSTANTS.WILDCARD_RECURSIVE) return ".*";
    return part.replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&");
  });

  return new RegExp(`^${regexParts.join("\\.")}$`);
}

export class PatternMatcher {
  private cache = new Map<string, RegExp>();

  public match(pattern: string, eventName: string): boolean {
    if (pattern === eventName) return true;
    if (!isWildcardPattern(pattern)) return false;

    let regex = this.cache.get(pattern);
    if (!regex) {
      regex = compilePatternToRegex(pattern);
      this.cache.set(pattern, regex);
    }

    return regex.test(eventName);
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const patternMatcher = new PatternMatcher();
