export const SLEEPY_BYE_QUOTES: string[] = [
  "All these byes just mean you don't want the night to end.\nClose your eyes now, it's time to rest.\nGoodnight, [username]. 🌙",
  "All these byes just mean it's time to rest.\nThe conversation will be right here tomorrow.\nGoodnight, [username]. 🕯️",
  "Neither of you is actually going to leave, are you?\nGo to sleep. Sweet dreams, [username]. ✨",
  "Every 'bye' is just another way of saying stay.\nBut for tonight, sleep well, [username]. 🤍",
  "That was your fifth 'final' bye in ten minutes.\nPut the phone down and rest, [username]. 🧸",
  "The world is quiet and so should you be.\nRest easy, [username]. Tomorrow brings new stories. 🌌",
  "Don't worry, the chat won't run away overnight.\nRest your eyes now, [username]. 🛌",
  "Saying goodbye is hard when the conversation is this sweet.\nBut the pillow calls. Rest peacefully, [username]. 🍯",
  "Look at you two, lingering in the doorway of sleep.\nStep inside. Sweet dreams, [username]. 🚪",
  "Even the moon thinks you two should be asleep by now.\nClose the screen, [username]. 🌙",
  "All good chapters pause for a night of rest.\nBookmark this page and sleep well, [username]. 📖",
  "You can pick right back up where you left off with morning coffee.\nRest now, [username]. ☕",
  "No more byes allowed tonight.\nOnly deep breaths and soft pillows.\nGoodnight, [username]. ☁️",
  "At this rate, your 'goodnight' is going to bump right into their 'good morning'.\nGo to sleep, [username]. ⏰",
  "The conversation was wonderful, but your pillow misses you more.\nRest peacefully, [username]. 🪶",
  "A circle of byes with no exit in sight.\nAllow me to close the door for you.\nSleep well, [username]. 🚪✨",
  "Soft thoughts, quiet night, warm blankets.\nYou've earned your rest, [username]. 🕯️",
  "That's officially enough byes to knit a whole sweater.\nGet some sleep, [username]. 🧶",
  "It's safe to let go of the screen now.\nThe universe will still be spinning tomorrow.\nGoodnight, [username]. 🪐",
  "The best conversations don't end—they just rest until tomorrow.\nSweet dreams, [username]. 🌿",
  "Some conversations are hard to leave, but sleep is waiting with open arms.\nRest sweet, [username]. 🫂",
  "The stars have been on duty for hours waiting for you to turn off this screen.\nGoodnight, [username]. 🌠",
  "May your dreams be as gentle and kind as the words you shared tonight.\nSleep softly, [username]. 🌸",
  "The night is wrapping everything in velvet silence.\nLet yourself drift off, [username]. 🕊️",
  "If byes were pennies, you'd both be rich by now.\nSave the rest for tomorrow. Goodnight, [username]. 🪙",
  "You don't have to say the final word.\nJust let the silence be peaceful.\nSleep well, [username]. 🤍",
  "Between words and sleep lies a quiet moment just for you.\nRest now, [username]. 🪶",
  "The best messages are the ones you wake up to.\nGo find out in the morning. Rest now, [username]. 💌",
  "Shut your eyes and let the warmth of this conversation tuck you in.\nSweet dreams, [username]. 🛌",
  "End of the line, sleepyhead.\nPhone down, eyes closed.\nGoodnight, [username]. 💤"
];

/**
 * Returns today's designated quote from the 30 curated lines,
 * mapped to the day of the month (1-31) and formatted with clean line breaks.
 */
export function getDailyByeQuote(username?: string): string {
  const day = new Date().getDate(); // 1 - 31
  const index = (day - 1) % SLEEPY_BYE_QUOTES.length;
  const rawQuote = SLEEPY_BYE_QUOTES[index];
  const safeName = username?.trim() || "sleepyhead";
  return rawQuote.replace(/\[username\]/g, safeName);
}
