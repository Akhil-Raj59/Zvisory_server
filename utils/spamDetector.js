/**
 * Detects common bot/gibberish patterns.
 */

import { response } from "express";

const RANDOM_SEQUENCE_REGEX = /[A-Za-z]{20,}/;
const REPEATED_CHAR_REGEX = /(.)\1{5,}/;
const URL_REGEX = /(https?:\/\/|www\.)/i;

export function isSpamMessage({ name, message = "" }) {
  const reasons = [];

  // Reject URLs
  if (URL_REGEX.test(message)) {
    reasons.push("Message contains URL");
  }

  // Long random character sequences in name
  if (RANDOM_SEQUENCE_REGEX.test(name)) {
    reasons.push("Suspicious random name");
  }

  // Check if any SINGLE word in the message is unusually long (gibberish/random string)
  // Instead of rejecting the entire message, we can flag it as suspicious and let the user know.
  const hasRandomWord = message
    .split(/\s+/)
    .some((word) => RANDOM_SEQUENCE_REGEX.test(word));

  if (hasRandomWord) {
    reasons.push("Suspicious random message");
  }

  // Repeated chars
  if (REPEATED_CHAR_REGEX.test(message)) {
    reasons.push("Repeated characters");
  }

  // Word count
  const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 3) {
    reasons.push("Message too short");
  }
  else {
     response.push("")
  }
  const words = message
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    isSpam: reasons.length > 0,
    reasons,
  };
} 